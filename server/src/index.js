import "dotenv/config";
import express from "express";
import cors from "cors";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import stationRoutes from "./routes/stations.js";
import attemptRoutes from "./routes/attempts.js";
import aiRoutes from "./routes/ai.js";

const app = express();

// Allow the web app's origin(s) to call the API. Set CORS_ORIGINS in .env.
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

// Images are sent as data URLs inside station payloads, so allow a large body.
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/stations", stationRoutes);
app.use("/attempts", attemptRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 8080;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Hakim API listening on :${PORT}`));
  })
  .catch((e) => {
    console.error("Failed to start — database init error:", e.message);
    process.exit(1);
  });
