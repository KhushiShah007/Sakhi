# Deploy

> **Honesty note.** None of these deployments was run from the authoring environment (no Docker, Render or Vercel access). The app, tests and migrations are verified locally; follow these steps and expect to fix small things on first run.

The app is **one Node process**: it serves the web app and the API from the same origin (so cookies and CSRF just work) and runs the monthly letter job. It needs Postgres.

## Required environment in production
`NODE_ENV=production`, `DATABASE_URL`, `SAKHI_DATA_KEY` (32 random bytes, base64), `OTP_WEBHOOK_URL` (+ `OTP_WEBHOOK_TOKEN`), `PUBLIC_URL`. Never set `DEMO_AUTH=true` (the server refuses to start). Optional: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, WhatsApp variables, `ADMIN_KEY`. See SETUP.md and `.env.example`.

## On your own computer (most reliable for a live demo)
`npm install` once, then `npm run demo` (Windows: double-click `start-demo.bat`). It builds the site if needed, starts the server with demo sign-in and the fictional demo data, and opens http://localhost:8787. Sign in with 9999900001 and code 123456. Keep the window open while presenting. Chrome treats localhost as secure, so the microphone works.
To give someone else a temporary link to your running copy: `cloudflared tunnel --url http://localhost:8787` (free, no account; install cloudflared first) prints an https address that works while your computer is on.

## Vercel: the static site (free, about 2 minutes)
The static build only (no sign-in or database; Vent and Rehearsal run in the browser and save on the device). `vercel.json` is already set up.
1. https://vercel.com/new → **Import** the Sakhi repo from GitHub (Hobby plan is free).
2. Leave the defaults (it reads `vercel.json`: `npm run build:web`, output `dist`) → **Deploy**.
3. Open the `https://<project>.vercel.app` address. Every push redeploys.
The full app (sign-in, database, family links) is not supported on Vercel: it is a long-running server. Use Render or a container host for that.

## Render: public demo of the full app (free, about 5 minutes)
Uses `render-demo.yaml`: sign in with any phone number and the code `123456`, fictional data only, resets when the service restarts. Not for real users.
1. https://dashboard.render.com/blueprints → **New Blueprint Instance** → connect GitHub → pick the Sakhi repo.
2. **Blueprint file path**: `render-demo.yaml` → **Apply**. The first build takes about 5-8 minutes.
   If you created the service by hand instead (New → Web Service), add one environment variable: `DEMO_DEPLOY` = `true`, then redeploy. Without it the server starts in production mode and stops with "DATABASE_URL is required in production".
3. Open the URL Render shows (`https://sakhi-demo.onrender.com`). Demo login `+919999900001`, code `123456`. HR dashboard code `NAVRANG-HR-DEMO`; admin key is in the service's **Environment** tab (`ADMIN_KEY`).
4. The free plan sleeps after 15 idle minutes; the next visit takes about 30 seconds to wake.

## Render: production (about 10 minutes)
1. Push the repo to GitHub.
2. Render → **New → Blueprint** → pick the repo. `render.yaml` creates the web service (Docker) and a Postgres database and wires `DATABASE_URL`.
3. In the service's **Environment**, set `SAKHI_DATA_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`), `OTP_WEBHOOK_URL`, `OTP_WEBHOOK_TOKEN`, `PUBLIC_URL` (`https://<service>.onrender.com`), and any optional keys.
4. Deploy. Migrations run on start. Check `https://<service>/healthz` → `{"ok":true,"demoAuth":false,...}`.
5. Optional demo data: Shell → `npx tsx server/src/seed.ts` (fictional data only; do **not** seed a real production database). Sign-in for the demo user needs `DEMO_AUTH`, which production forbids; use a staging service for demos.

## Vercel + Neon
Vercel runs serverless functions, but this app is a long-running server (the monthly job, an in-memory rate limiter, embedded static serving). The supported path is: **Neon for Postgres** (set `DATABASE_URL` to the Neon connection string) with the app on Render/Railway/Fly/any container host. Splitting the static web app onto Vercel would need the API on a separate origin plus CORS and `SameSite=None` cookies, which this code does not configure. Treat Vercel-only hosting as **not supported**.

## Docker locally
`docker compose up --build` → http://localhost:8787 (compose sets `DEMO_AUTH=true` for local use only).

## After deploying
- Run through SAFETY.md's validation plan before any user sees it.
- Set `HELPLINES_JSON` for your region if not India.
- Put the privacy notice (PRIVACY.md) in front of users and list any third-party processors you enabled.
