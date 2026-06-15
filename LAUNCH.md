# 🚀 Launch checklist — Hakīm

Follow these in order. **Part A** lets you see it on your own computer in minutes.
**Part B** puts it on the internet. **Part C** turns on paid memberships.

---

## Part A — See it on your computer (10 min)

- [ ] **Install Docker Desktop** from docker.com and open it (wait for the whale
      icon to go steady).
- [ ] **Get the code**: on GitHub, branch `claude/intelligent-heisenberg-kpc4bx`
      → green **Code** button → **Download ZIP** → unzip.
- [ ] **Get a Claude API key**: console.anthropic.com → **API Keys** → Create →
      copy it (`sk-ant-…`).
- [ ] In the project folder, copy `.env.example` to a new file named **`.env`**
      and paste your key: `ANTHROPIC_API_KEY=sk-ant-...`
- [ ] Open a terminal in the folder and run: **`docker compose up --build`**
- [ ] Open **http://localhost:5173** → create an account → try a station.

✅ If a station runs and you get a mark sheet, everything works. Stop with
`Ctrl+C`. (No payments needed for this step — the paywall stays off until Part C.)

---

## Part B — Put it on the internet (free tiers)

You'll deploy three pieces. Do them in this order.

### 1. Database (Railway)
- [ ] Create an account at railway.app.
- [ ] **New Project → Database → PostgreSQL.**
- [ ] Open it → **Variables/Connect** → copy the connection string
      (`postgresql://…`). Keep it handy.

### 2. API server (Railway)
- [ ] In the same project: **New → GitHub Repo** → pick this repo.
- [ ] Service **Settings → Root Directory = `server`**.
- [ ] **Variables** → add:
  - `DATABASE_URL` = the string from step 1
  - `PGSSL` = `true`
  - `JWT_SECRET` = a long random string
    (run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
  - `ANTHROPIC_API_KEY` = your Claude key
  - `FACULTY_CODE` = a private code for your staff
  - `CORS_ORIGINS` = leave blank for now (filled in step 4)
  - `APP_URL` = leave blank for now (filled in step 4)
- [ ] Deploy. Open the service URL + `/health` → should show `{"ok":true}`.
      **Copy the API URL** (e.g. `https://hakim-api.up.railway.app`).

### 3. Web app (Netlify)
- [ ] Create an account at netlify.com → **Add new site → Import from Git** →
      pick this repo.
- [ ] **Base directory = `web`**, **Build command = `npm run build`**,
      **Publish directory = `web/dist`**.
- [ ] **Environment variables** → `VITE_API_URL` = your API URL from step 2.
- [ ] Deploy. **Copy the web URL** (e.g. `https://hakim-osce.netlify.app`).

### 4. Connect them
- [ ] Back in Railway (API service) set:
  - `CORS_ORIGINS` = your Netlify URL
  - `APP_URL` = your Netlify URL
- [ ] Redeploy. Open your Netlify URL — the live website. 🎉

### 5. Lock it down (do before sharing widely)
- [ ] Confirm both URLs are **https://** (they are by default — never use http).
- [ ] In the Anthropic console set a **monthly spend limit** (safety net).
- [ ] Double-check secrets are only in the host's Variables, never in the code.

---

## Part C — Turn on paid memberships (2Checkout)

Skip this to keep the app free. To charge a monthly membership (free trial
first, faculty exempt):

- [ ] Create a **2Checkout (Verifone)** seller account; finish verification +
      add your **bank account / card** for payouts.
- [ ] Create a **recurring subscription product** (set your monthly price).
- [ ] **Generate a Buy Link** for it.
- [ ] **Set up an IPN** pointing to `https://<your-API-URL>/billing/webhook`
      and copy its secret.
- [ ] In Railway (API service) add:
  - `TWOCHECKOUT_BUY_LINK` = the buy link
  - `TWOCHECKOUT_IPN_SECRET` = the IPN secret
  - `FREE_STATION_LIMIT` = e.g. `3`
- [ ] **Test in 2Checkout sandbox first**: subscribe with a test card and
      confirm your account flips to "active" after payment. Then switch to live.

> Card details are entered on 2Checkout's page, never on your site — there is no
> card data on your server to be stolen.

---

## Quick reference — where each key comes from

| Key | Where | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | API server (the AI) |
| `DATABASE_URL` | Railway Postgres → Connect | API server |
| `JWT_SECRET` | you generate it | API server (logins) |
| `FACULTY_CODE` | you choose it | unlocks faculty |
| `VITE_API_URL` | your Railway API URL | web app |
| `TWOCHECKOUT_BUY_LINK` / `_IPN_SECRET` | 2Checkout dashboard | memberships |
