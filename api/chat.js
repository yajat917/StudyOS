// Vercel Serverless Function: proxies AI requests to OpenRouter
// The API key is stored securely as a Vercel environment variable (OPENROUTER_API_KEY).

const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const UPSTREAM_TIMEOUT_MS = 20_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TOTAL_CONTENT_LENGTH = 24_000;
const MAX_TOKENS = 1_200;
const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

function sendError(res, status, code, message, retryAfter) {
  if (retryAfter) res.setHeader("Retry-After", retryAfter);
  res.status(status).json({ error: message, code });
}

function getRetryAfter(response) {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  if (/^\d{1,6}$/.test(value)) return value;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : new Date(date).toUTCString();
}

function validateRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object.";
  }

  const { messages, maxTokens = 800, temperature = 0.7 } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return "'messages' must be a non-empty array.";
  }
  if (messages.length > MAX_MESSAGES) {
    return `A maximum of ${MAX_MESSAGES} messages is allowed.`;
  }

  let totalLength = 0;
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return "Each message must be an object.";
    }
    if (!ALLOWED_ROLES.has(message.role)) {
      return "Each message must use an allowed role.";
    }
    if (typeof message.content !== "string" || message.content.trim().length === 0) {
      return "Each message must contain non-empty text content.";
    }
    if (message.content.length > MAX_MESSAGE_LENGTH) {
      return `Each message is limited to ${MAX_MESSAGE_LENGTH} characters.`;
    }
    totalLength += message.content.length;
  }
  if (totalLength > MAX_TOTAL_CONTENT_LENGTH) {
    return `Total message content is limited to ${MAX_TOTAL_CONTENT_LENGTH} characters.`;
  }
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) {
    return `maxTokens must be an integer between 1 and ${MAX_TOKENS}.`;
  }
  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return "temperature must be a number between 0 and 2.";
  }

  return null;
}

function shouldUseFallback(status) {
  // Only retry failures that can indicate temporary/provider/model availability.
  return [404, 408, 500, 502, 503, 504].includes(status);
}

async function requestOpenRouter(payload, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function logProviderFailure(attempt, model, response) {
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

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    sendError(res, 500, "CONFIGURATION_ERROR", "AI service is not configured.");
    return;
  }

  const validationError = validateRequest(req.body);
  if (validationError) {
    sendError(res, 400, "INVALID_REQUEST", validationError);
    return;
  }

  const { messages, temperature = 0.7, maxTokens = 800 } = req.body;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
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
      if (error.name === "AbortError") {
        sendError(res, 504, "UPSTREAM_TIMEOUT", "The AI service took too long to respond.");
      } else {
        console.error("OpenRouter network failure", { name: error.name });
        sendError(res, 502, "UPSTREAM_NETWORK_ERROR", "The AI service could not be reached.");
      }
      return;
    }

    logProviderFailure("primary", PRIMARY_MODEL, response);

    if (!response.ok && shouldUseFallback(response.status)) {
      payload.model = FALLBACK_MODEL;
      try {
        response = await requestOpenRouter(payload, headers);
      } catch (error) {
        if (error.name === "AbortError") {
          sendError(res, 504, "UPSTREAM_TIMEOUT", "The AI service took too long to respond.");
        } else {
          console.error("OpenRouter fallback network failure", { name: error.name });
          sendError(res, 502, "UPSTREAM_NETWORK_ERROR", "The AI service could not be reached.");
        }
        return;
      }
      logProviderFailure("fallback", FALLBACK_MODEL, response);
    }

    if (!response.ok) {
      const retryAfter = response.status === 429 ? getRetryAfter(response) : null;
      if (response.status === 400) {
        sendError(res, 400, "INVALID_REQUEST", "The AI request was invalid.");
      } else if (response.status === 401) {
        sendError(res, 502, "UPSTREAM_AUTHENTICATION_FAILED", "The AI service authentication failed.");
      } else if (response.status === 403) {
        sendError(res, 502, "UPSTREAM_ACCESS_DENIED", "The AI service denied access.");
      } else if (response.status === 429) {
        sendError(res, 429, "RATE_LIMITED", "The AI service is temporarily rate limited. Please try again later.", retryAfter);
      } else {
        sendError(res, response.status >= 500 ? 502 : response.status, "UPSTREAM_PROVIDER_ERROR", "The AI service is temporarily unavailable.");
      }
      return;
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      console.error("OpenRouter returned malformed JSON", { name: error.name });
      sendError(res, 502, "UPSTREAM_PROVIDER_ERROR", "The AI service returned an invalid response.");
      return;
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      sendError(res, 502, "UPSTREAM_PROVIDER_ERROR", "The AI service returned an empty response.");
      return;
    }

    res.status(200).json({ content });
  } catch (error) {
    console.error("Serverless function error", { name: error.name });
    sendError(res, 500, "UPSTREAM_PROVIDER_ERROR", "The AI service is temporarily unavailable.");
  }
};
