import { Router } from "express";
import { requireAuth } from "../auth-util.js";

const router = Router();

// Free-tier AI fallback via Google Gemini. Used only when the scripted patient
// has no matching reply. Get a free API key at https://aistudio.google.com/apikey
// and set GEMINI_API_KEY. If it's not set, we return an empty reply and the
// client shows the station's scripted fallback line — so the app still works.
router.post("/", requireAuth, async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.json({ text: "" });

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const { system, messages } = req.body || {};

  // Map our {role: user|assistant} history to Gemini's {role: user|model}.
  const contents = (messages || []).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents,
          generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) {
      // Quota exhausted or other error — let the client fall back gracefully.
      return res.json({ text: "" });
    }
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();
    res.json({ text });
  } catch (e) {
    res.json({ text: "" });
  }
});

export default router;
