import { Router } from "express";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { q } from "../db.js";
import { signToken, requireAuth, publicUser } from "../auth-util.js";

const router = Router();
const FACULTY_CODE = process.env.FACULTY_CODE || "osce-faculty";
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const emailOk = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function roleFor(code) {
  return code && code.trim() === FACULTY_CODE ? "faculty" : "student";
}

// ---- email + password sign-up ----
router.post("/signup", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const name = (req.body.name || "").trim();
    if (!emailOk(email)) return res.status(400).json({ error: "Enter a valid email address" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const existing = await q("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount) return res.status(409).json({ error: "An account with this email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const role = roleFor(req.body.facultyCode);
    const { rows } = await q(
      "INSERT INTO users (email, password_hash, name, role) VALUES ($1,$2,$3,$4) RETURNING *",
      [email, hash, name || email.split("@")[0], role]
    );
    const user = rows[0];
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Could not create the account" });
  }
});

// ---- email + password login ----
router.post("/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const { rows } = await q("SELECT * FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !user.password_hash) return res.status(401).json({ error: "Wrong email or password" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Wrong email or password" });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: "Could not sign in" });
  }
});

// ---- Google sign-in ----
// The browser obtains a Google ID token and posts it here; we verify it,
// then create or find the matching account.
router.post("/google", async (req, res) => {
  try {
    const credential = req.body.credential;
    if (!credential) return res.status(400).json({ error: "Missing Google credential" });
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = (payload.email || "").toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || email.split("@")[0];
    if (!email) return res.status(400).json({ error: "Google account has no email" });

    let { rows } = await q("SELECT * FROM users WHERE google_id = $1 OR email = $2", [googleId, email]);
    let user = rows[0];
    if (!user) {
      const role = roleFor(req.body.facultyCode);
      const ins = await q(
        "INSERT INTO users (email, google_id, name, role) VALUES ($1,$2,$3,$4) RETURNING *",
        [email, googleId, name, role]
      );
      user = ins.rows[0];
    } else if (!user.google_id) {
      const upd = await q("UPDATE users SET google_id = $1 WHERE id = $2 RETURNING *", [googleId, user.id]);
      user = upd.rows[0];
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(401).json({ error: "Could not verify Google sign-in" });
  }
});

// ---- who am I (used to restore a session on page load) ----
router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(rows[0]) });
});

// ---- upgrade an existing account to faculty with the code ----
router.post("/faculty-upgrade", requireAuth, async (req, res) => {
  if ((req.body.code || "").trim() !== FACULTY_CODE) {
    return res.status(403).json({ error: "Incorrect faculty code" });
  }
  const { rows } = await q("UPDATE users SET role = 'faculty' WHERE id = $1 RETURNING *", [req.user.id]);
  const user = rows[0];
  res.json({ token: signToken(user), user: publicUser(user) });
});

export default router;
