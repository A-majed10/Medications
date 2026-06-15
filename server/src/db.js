import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});

export const q = (text, params) => pool.query(text, params);

// Create tables on boot if they don't exist yet, so there's no separate
// migration step to run when you deploy.
export async function initDb() {
  await q(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      google_id     TEXT UNIQUE,
      name          TEXT,
      role          TEXT NOT NULL DEFAULT 'student',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS stations (
      id           TEXT PRIMARY KEY,
      owner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title        TEXT NOT NULL,
      category     TEXT NOT NULL DEFAULT 'other',
      duration_min INTEGER NOT NULL DEFAULT 8,
      task         TEXT,
      brief        TEXT NOT NULL,
      images       JSONB NOT NULL DEFAULT '[]'::jsonb,
      rubric       JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_public    BOOLEAN NOT NULL DEFAULT true,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`
    CREATE TABLE IF NOT EXISTS attempts (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      station_id    TEXT,
      station_title TEXT,
      category      TEXT,
      overall       INTEGER,
      verdict       TEXT,
      domains       JSONB,
      transcript    JSONB,
      duration_sec  INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await q(`CREATE INDEX IF NOT EXISTS attempts_user_idx ON attempts(user_id);`);
  await q(`CREATE INDEX IF NOT EXISTS attempts_created_idx ON attempts(created_at);`);
}
