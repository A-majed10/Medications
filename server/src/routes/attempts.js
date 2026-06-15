import { Router } from "express";
import { q } from "../db.js";
import { requireAuth, requireFaculty } from "../auth-util.js";

const router = Router();

const toClient = (r) => ({
  id: r.id,
  userId: r.user_id,
  userEmail: r.user_email,
  userName: r.user_name,
  stationId: r.station_id,
  stationTitle: r.station_title,
  category: r.category,
  overall: r.overall,
  verdict: r.verdict,
  domains: r.domains || [],
  transcript: r.transcript || [],
  durationSec: r.duration_sec,
  createdAt: r.created_at,
});

// Save a finished attempt (after the examiner has graded it).
router.post("/", requireAuth, async (req, res) => {
  const b = req.body || {};
  const { rows } = await q(
    `INSERT INTO attempts (user_id, station_id, station_title, category, overall, verdict, domains, transcript, duration_sec)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      req.user.id,
      b.stationId || null,
      b.stationTitle || null,
      b.category || null,
      b.overall != null ? Math.round(Number(b.overall)) : null,
      b.verdict || null,
      JSON.stringify(b.domains || []),
      JSON.stringify(b.transcript || []),
      b.durationSec != null ? Number(b.durationSec) : null,
    ]
  );
  res.json({ attempt: toClient(rows[0]) });
});

// A learner's own history.
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await q("SELECT * FROM attempts WHERE user_id = $1 ORDER BY created_at DESC", [req.user.id]);
  res.json({ attempts: rows.map(toClient) });
});

// Faculty view of every student's attempts (optionally filtered to one user).
router.get("/", requireAuth, requireFaculty, async (req, res) => {
  const userId = req.query.userId ? Number(req.query.userId) : null;
  const { rows } = await q(
    `SELECT a.*, u.email AS user_email, u.name AS user_name
     FROM attempts a JOIN users u ON u.id = a.user_id
     ${userId ? "WHERE a.user_id = $1" : ""}
     ORDER BY a.created_at DESC LIMIT 500`,
    userId ? [userId] : []
  );
  res.json({ attempts: rows.map(toClient) });
});

export default router;
