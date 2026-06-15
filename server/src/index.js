import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import stationRoutes from "./routes/stations.js";
import attemptRoutes from "./routes/attempts.js";
import claudeRoutes from "./routes/claude.js";
import billingRoutes, { webhookHandler } from "./routes/billing.js";

const app = express();

// Allow the web app's origin(s) to call the API. Set CORS_ORIGINS in .env.
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

// Stripe's webhook signature is verified against the raw body, so this route
// must be registered BEFORE the JSON body parser.
app.post("/billing/webhook", express.raw({ type: "application/json" }), webhookHandler);

// Images are sent as data URLs inside station payloads, so allow a large body.
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/stations", stationRoutes);
app.use("/attempts", attemptRoutes);
app.use("/api/claude", claudeRoutes);
app.use("/billing", billingRoutes);

const PORT = process.env.PORT || 8080;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Hakim API listening on :${PORT}`));
  })
  .catch((e) => {
    console.error("Failed to start — database init error:", e.message);
    process.exit(1);
  });
