import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

// Express middleware: verifies the Bearer token and attaches req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired — please sign in again" });
  }
}

export function requireFaculty(req, res, next) {
  if (!req.user || req.user.role !== "faculty") {
    return res.status(403).json({ error: "Faculty access only" });
  }
  next();
}

// Strip internal fields before sending a user to the client.
export function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}
