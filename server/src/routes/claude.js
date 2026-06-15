import { Router } from "express";
import { requireAuth } from "../auth-util.js";
import { q } from "../db.js";
import { membershipFor } from "../billing-util.js";

const router = Router();

// Proxies a request to Anthropic, adding the secret API key server-side so it
// never reaches the browser. Only signed-in members (or users still inside the
// free trial) can call it — this is what actually costs money, so it's gated.
router.post("/", requireAuth, async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "AI is not configured on the server" });

  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  const membership = await membershipFor(rows[0]);
  if (!membership.eligible) return res.status(402).json({ error: "Membership required" });

  const { system, messages, model, max_tokens } = req.body || {};
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-6",
        max_tokens: max_tokens || 1000,
        system,
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error?.message || "AI request failed" });
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    res.json({ text });
  } catch (e) {
    res.status(502).json({ error: "Could not reach the AI service" });
  }
});

export default router;
