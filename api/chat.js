// Vercel Serverless Function: proxies AI requests to OpenRouter
// The API key is stored as a Vercel environment variable (OPENROUTER_API_KEY)

const PRIMARY_MODEL = "google/gemma-4-31b-it:free";
const FALLBACK_MODEL = "google/gemma-4-26b-a4b-it:free";

module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "API key not configured on server." });
    return;
  }

  try {
    const { messages, temperature = 0.7, maxTokens = 800 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid request: 'messages' array is required." });
      return;
    }

    const payload = {
      model: PRIMARY_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": req.headers.referer || req.headers.origin || "https://studyos.vercel.app",
      "X-OpenRouter-Title": "StudyOS",
    };

    // Try primary model
    let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    // Fallback to secondary model
    if (!response.ok) {
      payload.model = FALLBACK_MODEL;
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      res.status(response.status).json({
        error: `AI service error (${response.status})`,
      });
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Unable to generate a response.";

    res.status(200).json({ content });
  } catch (err) {
    console.error("Serverless function error:", err);
    res.status(500).json({ error: "Internal server error." });
  }
};
