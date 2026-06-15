import { Router } from "express";
import { q } from "../db.js";
import { requireAuth, requireFaculty } from "../auth-util.js";

const router = Router();

const toClient = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  durationMin: r.duration_min,
  task: r.task,
  brief: r.brief,
  images: r.images || [],
  rubric: r.rubric || [],
  ownerId: r.owner_id,
});

// Everyone signed in sees the shared (public) faculty stations.
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await q(
    "SELECT * FROM stations WHERE is_public = true OR owner_id = $1 ORDER BY created_at DESC",
    [req.user.id]
  );
  res.json({ stations: rows.map(toClient) });
});

function readBody(b) {
  return {
    title: (b.title || "").trim(),
    category: b.category || "other",
    duration_min: Number(b.durationMin) || 8,
    task: (b.task || "").trim(),
    brief: (b.brief || "").trim(),
    images: Array.isArray(b.images) ? b.images : [],
    rubric: Array.isArray(b.rubric) ? b.rubric : [],
  };
}

// Faculty create a station.
router.post("/", requireAuth, requireFaculty, async (req, res) => {
  const s = readBody(req.body);
  if (!s.title || !s.brief || s.rubric.length === 0) {
    return res.status(400).json({ error: "Title, patient brief and at least one rubric domain are required" });
  }
  const id = "c" + Date.now() + Math.floor(Math.random() * 1000);
  const { rows } = await q(
    `INSERT INTO stations (id, owner_id, title, category, duration_min, task, brief, images, rubric, is_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING *`,
    [id, req.user.id, s.title, s.category, s.duration_min, s.task, s.brief, JSON.stringify(s.images), JSON.stringify(s.rubric)]
  );
  res.json({ station: toClient(rows[0]) });
});

// Faculty update their own station.
router.put("/:id", requireAuth, requireFaculty, async (req, res) => {
  const s = readBody(req.body);
  const { rows } = await q(
    `UPDATE stations SET title=$1, category=$2, duration_min=$3, task=$4, brief=$5, images=$6, rubric=$7
     WHERE id=$8 AND owner_id=$9 RETURNING *`,
    [s.title, s.category, s.duration_min, s.task, s.brief, JSON.stringify(s.images), JSON.stringify(s.rubric), req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Station not found or not yours" });
  res.json({ station: toClient(rows[0]) });
});

router.delete("/:id", requireAuth, requireFaculty, async (req, res) => {
  const { rowCount } = await q("DELETE FROM stations WHERE id=$1 AND owner_id=$2", [req.params.id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: "Station not found or not yours" });
  res.json({ ok: true });
});

export default router;
