const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UPSTREAM_TIMEOUT_MS = 20000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TOTAL_CONTENT_LENGTH = 24000;
const MAX_TOKENS = 1200;
const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

function sendError(res, status, code, message, retryAfter) {
  if (retryAfter) res.setHeader("Retry-After", retryAfter);
  res.status(status).json({ error: message, code });
}

function retryAfterHeader(response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  if (/^\d{1,6}$/.test(value)) return value;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toUTCString();
}

function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object.";
  const { messages, maxTokens = 800, temperature = 0.7 } = body;
  if (!Array.isArray(messages) || messages.length === 0) return "'messages' must be a non-empty array.";
  if (messages.length > MAX_MESSAGES) return `A maximum of ${MAX_MESSAGES} messages is allowed.`;
  let total = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return "Each message must be an object.";
    if (!ALLOWED_ROLES.has(message.role)) return "Each message must use an allowed role.";
    if (typeof message.content !== "string" || !message.content.trim()) return "Each message must contain non-empty text content.";
    if (message.content.length > MAX_MESSAGE_LENGTH) return `Each message is limited to ${MAX_MESSAGE_LENGTH} characters.`;
    total += message.content.length;
  }
  if (total > MAX_TOTAL_CONTENT_LENGTH) return `Total message content is limited to ${MAX_TOTAL_CONTENT_LENGTH} characters.`;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) return `maxTokens must be an integer between 1 and ${MAX_TOKENS}.`;
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) return "temperature must be a number between 0 and 2.";
  return null;
}

function shouldUseFallback(status) {
  return [404, 408, 500, 502, 503, 504].includes(status);
}

async function requestOpenRouter(payload, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(OPENROUTER_URL, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function logFailure(attempt, model, response) {
  if (response.ok) return;
  console.error("OpenRouter request failed", {
    attempt,
    model,
    status: response.status,
    providerRequestId: response.headers.get("x-request-id") || undefined,
  });
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");

  if (!process.env.OPENROUTER_API_KEY) return sendError(res, 500, "CONFIGURATION_ERROR", "AI service is not configured.");
  const validationError = validateRequest(req.body);
  if (validationError) return sendError(res, 400, "INVALID_REQUEST", validationError);

  const { messages, temperature = 0.7, maxTokens = 800 } = req.body;
  const headers = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": req.headers.referer || req.headers.origin || "https://study-os-virid.vercel.app",
    "X-OpenRouter-Title": "StudyOS",
  };
  const payload = { model: PRIMARY_MODEL, messages, temperature, max_tokens: maxTokens, stream: false };

  try {
    let response;
    try {
      response = await requestOpenRouter(payload, headers);
    } catch (error) {
      if (error.name === "AbortError") return sendError(res, 504, "UPSTREAM_TIMEOUT", "The AI service took too long to respond.");
      console.error("OpenRouter network failure", { name: error.name });
      return sendError(res, 502, "UPSTREAM_NETWORK_ERROR", "The AI service could not be reached.");
    }
    logFailure("primary", PRIMARY_MODEL, response);

    if (!response.ok && shouldUseFallback(response.status)) {
      payload.model = FALLBACK_MODEL;
      try {
        response = await requestOpenRouter(payload, headers);
      } catch (error) {
        if (error.name === "AbortError") return sendError(res, 504, "UPSTREAM_TIMEOUT", "The AI service took too long to respond.");
        console.error("OpenRouter fallback network failure", { name: error.name });
        return sendError(res, 502, "UPSTREAM_NETWORK_ERROR", "The AI service could not be reached.");
      }
      logFailure("fallback", FALLBACK_MODEL, response);
    }

    if (!response.ok) {
      const retryAfter = response.status === 429 ? retryAfterHeader(response) : null;
      if (response.status === 400) return sendError(res, 400, "INVALID_REQUEST", "The AI request was invalid.");
      if (response.status === 401) return sendError(res, 502, "UPSTREAM_AUTHENTICATION_FAILED", "The AI service authentication failed.");
      if (response.status === 403) return sendError(res, 502, "UPSTREAM_ACCESS_DENIED", "The AI service denied access.");
      if (response.status === 429) return sendError(res, 429, "RATE_LIMITED", "The AI service is temporarily rate limited. Please try again later.", retryAfter);
      return sendError(res, response.status >= 500 ? 502 : response.status, "UPSTREAM_PROVIDER_ERROR", "The AI service is temporarily unavailable.");
    }

    let data;
    try { data = await response.json(); } catch (error) {
      console.error("OpenRouter returned malformed JSON", { name: error.name });
      return sendError(res, 502, "UPSTREAM_PROVIDER_ERROR", "The AI service returned an invalid response.");
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.length) return sendError(res, 502, "UPSTREAM_PROVIDER_ERROR", "The AI service returned an empty response.");
    return res.status(200).json({ content });
  } catch (error) {
    console.error("Serverless function error", { name: error.name });
    return sendError(res, 500, "UPSTREAM_PROVIDER_ERROR", "The AI service is temporarily unavailable.");
  }
};
