# Hakīm — OSCE clinical-skills trainer

An AI-powered OSCE practice app. Learners talk to a realistic AI standardized
patient under exam conditions, then receive an examiner-graded mark sheet.
Faculty author their own stations, group them by specialty, and attach images
(ECGs, X-rays, labs). Everyone signs in; every attempt — score and full
transcript — is saved so learners can track progress and faculty can review
their students.

This repo has two parts:

```
server/   Node + Express + Postgres API  (auth, stations, attempts, AI proxy)
web/      React (Vite) front-end          (the app learners and faculty use)
```

The original single-file artifact (`oscetrainer.jsx`) is kept at the repo root
for reference; the live app is `web/src/OsceApp.jsx`.

---

## How the AI works

All AI calls go through the backend, never the browser directly:

1. **Standardized patient** — when the learner sends a message, the front-end
   calls `POST /api/claude`. The server attaches your secret Anthropic API key
   and forwards a system prompt built from the station's hidden patient brief
   (stay in character, reveal details only when asked, reply in 1–3 sentences,
   EN/AR). The whole conversation is replayed each turn so the patient stays
   consistent.
2. **Examiner** — when the station ends, the rubric plus the full transcript are
   sent (again via the proxy) with a strict "return only minified JSON" prompt.
   The app parses that JSON into the mark sheet and then saves the attempt.

Because the key lives only on the server, it never reaches users. Voice
input/output uses the browser's Web Speech API and is not AI.

---

## Run it locally — one command (Docker)

If you have Docker, this brings up Postgres, the API, and the web app together:

```bash
cp .env.example .env        # put your ANTHROPIC_API_KEY in it
docker compose up --build
```

Then open http://localhost:5173. The database, tables, and all three services
are created for you. Only `ANTHROPIC_API_KEY` is required; the rest default to
local-dev values. (Add `GOOGLE_CLIENT_ID` to enable Google sign-in.)

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
| `ANTHROPIC_API_KEY` | Your Anthropic key (from console.anthropic.com) |
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
   string for `DATABASE_URL`, set `PGSSL=true`, paste your `ANTHROPIC_API_KEY`,
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

## Paid memberships (optional)

To make the app pay for its own API usage, you can put it behind a **monthly
subscription with a free trial**, handled by **2Checkout (Verifone)** — a
merchant of record that accepts international cards and pays out to a normal bank
account/card (works for sellers in Lebanon). If you don't set the 2Checkout
variables, there is **no paywall** — everyone has unlimited free access.

**You never touch card data.** Card details are entered on 2Checkout's own
PCI-certified hosted page, not your site. 2Checkout charges the customer, pays
you, and notifies your server (the IPN webhook) to mark the account active. So
there is no card information on your server to steal.

**How it works:** every user signs up free and gets `FREE_STATION_LIMIT`
stations (default 3). After that, running a station requires an active
subscription. The server checks membership before every AI call — real
enforcement, not a hidden button. **Faculty are exempt.** Members manage/cancel
in 2Checkout's myAccount portal ("Manage membership" in the footer).

**Setup (2Checkout Control Panel):**
1. Create a **recurring (subscription) product** (e.g. $9/month).
2. **Generate a Buy Link** for it → paste into `TWOCHECKOUT_BUY_LINK`.
3. Set up an **IPN** pointing to `https://<your-api>/billing/webhook` and copy
   its secret into `TWOCHECKOUT_IPN_SECRET` (used to verify notifications).
4. Set `APP_URL` to your web app's public URL and `FREE_STATION_LIMIT` to taste.

**Pricing note:** set the membership above what a user costs you in API calls (a
few cents per station) plus 2Checkout's fee, or it won't cover costs. **Test in
2Checkout's sandbox before going live** — the IPN signature handling can vary by
account; if a test notification is rejected, share the payload and it's a quick
fix.

## Deploying safely — security & traffic

The server ships with sensible hardening already in place:

- **Secure headers** (`helmet`), **gzip** (`compression`), and **CORS locked**
  to the origins you list in `CORS_ORIGINS`.
- **Rate limiting** — a generous global cap, a strict cap on `/auth` (blocks
  password brute-force), and a cap on the AI endpoint (limits abuse and runaway
  cost). Tune the numbers in `server/src/index.js`.
- **Passwords** are bcrypt-hashed; **sessions** are signed JWTs; **all SQL is
  parameterised** (no injection); the **API key never reaches the browser**;
  the **Stripe webhook is signature-verified**.

Your part when you deploy:

1. **Use HTTPS** — Railway/Render/Netlify give every app a free TLS certificate
   automatically. Never serve this over plain HTTP.
2. **Strong secrets** — set a long random `JWT_SECRET` (the generator command is
   above) and a non-obvious `FACULTY_CODE`. Keep all secrets in the host's
   environment variables, never in the code.
3. **Set an Anthropic spend limit** in the Anthropic console as a safety net,
   even with the paywall.
4. **Keep dependencies updated** (`npm audit` occasionally).

**Handling traffic / scaling:**

- The web app is static files on a CDN (Netlify/Vercel) — it absorbs large
  traffic effortlessly.
- The API is stateless, so to handle more load you raise the instance
  count/size on your host (Railway/Render scale with a slider); requests spread
  across instances automatically.
- The database is the main bottleneck. Start on a hosted Postgres free tier;
  upgrade the plan as users grow. Images are stored as data URLs in rows — fine
  for hundreds of stations; if you reach thousands of large images, move them to
  object storage (S3/Cloudflare R2) and keep only URLs.

No app is "unhackable," but this covers the common risks (injection, brute
force, secret leakage, cost abuse, transport security) for an app of this size.

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
