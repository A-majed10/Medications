# Hakīm — OSCE clinical-skills trainer

A free OSCE practice app. Learners talk to a standardized patient under exam
conditions, then receive an examiner-graded mark sheet. Faculty author their own
stations, group them by specialty, and attach images (ECGs, X-rays, labs).
Everyone signs in; every attempt — score and full transcript — is saved so
learners can track progress and faculty can review their students.

This repo has two parts:

```
server/   Node + Express + Postgres API  (auth, stations, attempts)
web/      React (Vite) front-end          (the app learners and faculty use)
```

The original single-file artifact (`oscetrainer.jsx`) is kept at the repo root
for reference; the live app is `web/src/OsceApp.jsx`.

---

## How the patient and scoring work (and why it's free)

The standardized patient is a **hybrid** designed to cost nothing to run:

1. **Scripted replies (free, instant, offline).** Each station has a list of
   keyword-triggered answers the faculty wrote. When the student's question
   contains any of a reply's keywords, the patient gives that answer — no
   network call, no cost. Synonym keywords mean students can phrase a question
   many ways and still match.
2. **Free-tier AI fallback (optional).** When nothing matches, the server can
   ask **Google Gemini's free tier** for a smart, in-character reply built from
   the station's patient background. Get a free key at
   <https://aistudio.google.com/apikey> and set `GEMINI_API_KEY`. Leave it blank
   and the app simply uses the station's scripted fallback line — still fully
   usable with **no AI and no key at all.**
3. **Scoring is always local and free.** When the station ends, each rubric item
   is marked done/missed by keyword-matching the student's transcript, in the
   browser. No AI, deterministic, $0.

Voice input/output uses the browser's Web Speech API and is not AI.

---

## Run it locally — one command (Docker)

If you have Docker, this brings up Postgres, the API, and the web app together:

```bash
cp .env.example .env        # all values optional — see below
docker compose up --build
```

Then open http://localhost:5173. The database, tables, and all three services
are created for you. **No keys are required** — it runs on the free scripted
patient out of the box. Optionally add `GEMINI_API_KEY` (free) for the smart AI
fallback, or `GOOGLE_CLIENT_ID` for Google sign-in.

## Run it locally — manual

You need **Node 18+** and a **Postgres** database (local install, Docker, or a
free hosted one).

### 1. Backend

```bash
cd server
cp .env.example .env        # then fill in the values (see below)
npm install
npm run dev                 # starts on http://localhost:8080, creates tables automatically
```

`.env` values:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PGSSL` | `true` for hosted Postgres, `false` for local |
| `JWT_SECRET` | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GEMINI_API_KEY` | *(optional)* Free Google Gemini key for the AI fallback (aistudio.google.com/apikey) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (optional — for Google sign-in) |
| `FACULTY_CODE` | Anyone who signs up / upgrades with this code becomes faculty |
| `CORS_ORIGINS` | Comma-separated web origins allowed to call the API |

### 2. Front-end

```bash
cd web
cp .env.example .env        # set VITE_API_URL=http://localhost:8080
npm install
npm run dev                 # starts on http://localhost:5173
```

Open http://localhost:5173, create an account, and you're in. To become faculty,
enter the `FACULTY_CODE` either in the "Faculty code" box at sign-up or via the
**Faculty** button in the app.

---

## Where to host it (recommended path)

You don't need your own servers. The cheapest reliable setup:

- **API + database → [Railway](https://railway.app)** (or Render/Fly). Railway
  gives you a managed Postgres and a Node service on a generous free/low tier.
- **Web app → [Netlify](https://netlify.com)** (or Vercel/Cloudflare Pages).
  It's a static build, so hosting is free.

### A. Database + API on Railway

1. Create a Railway project → **New → Database → PostgreSQL**. Copy its
   connection string.
2. **New → GitHub Repo**, pick this repo. In the service settings set the
   **Root Directory** to `server`. Railway will run `npm install` then
   `npm start`.
3. Add the environment variables from the table above. Use Railway's Postgres
   string for `DATABASE_URL`, set `PGSSL=true`, optionally add `GEMINI_API_KEY`,
   generate a `JWT_SECRET`, pick a `FACULTY_CODE`. Leave `CORS_ORIGINS` for now.
4. Deploy. The tables are created automatically on first boot. Note the public
   URL Railway gives you (e.g. `https://hakim-api.up.railway.app`). Visit
   `/health` to confirm it returns `{"ok":true}`.

### B. Web app on Netlify

1. **Add new site → Import from Git**, pick this repo.
2. Set **Base directory** to `web`, **Build command** to `npm run build`, and
   **Publish directory** to `web/dist`.
3. Add environment variables:
   - `VITE_API_URL` = your Railway API URL from step A.
   - `VITE_GOOGLE_CLIENT_ID` = your Google client ID (if using Google sign-in).
4. Deploy. Copy the Netlify URL (e.g. `https://hakim-osce.netlify.app`).

### C. Connect them

Back in Railway, set `CORS_ORIGINS` to your Netlify URL (plus
`http://localhost:5173` if you still develop locally), comma-separated, and
redeploy. Done.

### Google "Sign in with Google" (optional)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   → **Create credentials → OAuth client ID → Web application**.
2. Under **Authorized JavaScript origins** add your web URL (Netlify) and
   `http://localhost:5173`.
3. Copy the **Client ID** into both `GOOGLE_CLIENT_ID` (server) and
   `VITE_GOOGLE_CLIENT_ID` (web). They must match.

If you skip this, email/password sign-in still works and the Google button is
hidden automatically.

---

## Data model

- **users** — id, email, password hash (for email sign-in), google_id (for
  Google sign-in), name, role (`student` | `faculty`).
- **stations** — faculty-authored cases (title, specialty/category, brief,
  rubric, images as data URLs), shared to all learners.
- **attempts** — one row per finished station: user, station, overall score,
  verdict, per-domain scores, the full transcript, and duration.

### Roles & access
- **Students** practise every station and see only their own progress.
- **Faculty** additionally author/edit/delete stations and see all students'
  attempts. A student becomes faculty by entering the `FACULTY_CODE`.

---

## Notes & next steps

- **Images** are stored as base64 data URLs inside the station record. That's
  fine for a handful of ECGs/X-rays. If you expect many large images, switch to
  object storage (e.g. an S3/Cloudflare R2 bucket) and store URLs instead — the
  server already keeps images in their own JSON field, so this is a contained
  change.
- **Cohorts** — faculty currently see *all* students. If you want per-class
  grouping, add a `cohort` column to users and filter `GET /attempts` by it.
- This is a practice tool, not for real clinical use.
