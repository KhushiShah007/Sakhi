# Progress

Honest status. The full brief is far larger than one session; this file says exactly what exists.

## Done (tested: `npm test`, 168 tests; `npm run test:safety`)
- [x] UI prototype (Vite + React, 4 languages, design system, demo route, screenshots) — pre-existing, simulated data
- [x] Safety core in `server/src/safety`: red-flag rules (self-harm, chest pain, bleeding, fainting, stroke, abuse) in hi/mr/gu/en/Hinglish with scripted replies and configurable helplines; LLM bypassed
- [x] Policy guard (diagnosis, dosage, HRT, jailbreak, other-user data, family-sees-words) with scripted refusals in 4 languages
- [x] LLM output blocklist + Zod-validated extraction with rule-based fallback; proposals only, `confirmEntries` is the single path to a log entry
- [x] MRS ontology (11 items), subscale/total scoring, severity bands, symptom lexicon
- [x] Rule-out engine ("Should we check...?") and Next 20 Years module, marked pending clinician review
- [x] Symptom Weather transparent additive score (labelled estimate)
- [x] k-anonymity with complementary suppression (k=10), AES-256-GCM field encryption, DEMO_AUTH production guard
- [x] Anthropic provider + keyless fallback behind one interface
- [x] AI safety suite: 80 adversarial prompts across 4 languages
- [x] Phase 2: Fastify API (`server/src/api/app.ts`) on Postgres (PGlite for dev/tests, `pg` via DATABASE_URL in prod), SQL migrations, phone+OTP auth (DEMO_AUTH fixed code / OTP_WEBHOOK_URL provider), under-18 block, httpOnly sessions, CSRF, rate limits, security headers, per-purpose append-only consent, audit log, talk->propose->confirm->log flow, brief endpoint, export, account deletion (`npm run api`)
- [x] Phase 6 (API side): people + trusted persons, enumerated Signal Cards in 4 languages, no-install family link (`/f/:token`), per-person permissions/pause/revoke/rotate, exact preview, quick replies, WhatsApp Cloud sender + signed webhooks (status tracking, quick replies), household weather alert (level only), HUI, teen content-only lessons, Say This/Not That + Repair Flow + 2-min modules (pending clinician review)
- [x] Triggers + time of day persisted with confirmed logs (she can correct them), feed Symptom Weather's stress factor
- [x] Live family link page (`src/family/FamilyLink.tsx`, route `#/f/:token`): WhatsApp-style, 4 languages, quick replies, estimate-labelled alert, lessons with pending-review tag, teen content-only, inactive-link state; verified in a real browser (`node scripts/e2e-family.mjs`)
- [x] API serves the built web app (same origin, no CORS); dev proxy in vite config
- [x] Web app wired to API (section 1): session context + API client, offline/anon/authed modes (static hosting keeps the demo), login with OTP + birth-year gate, per-purpose consent screen, live onboarding (language, name, stage, city, people + family links, voice answers with typed fallback), route guards, prototype strip removed when live (DEMO badge only if DEMO_MODE=true); verified by `node scripts/e2e-onboarding.mjs`
- [x] Live Vent Mode (section 2): voice (browser STT) or typed, live symptom chips from a rules-only preview endpoint, crisis interrupts mid-sentence with helplines and stores nothing, refusals, tap-to-correct severity/trigger, save only what she confirms, reflection read aloud; `node scripts/e2e-vent.mjs`
- [x] Live Home (section 3): `/api/home` (week strip, 30-day moods, check-in count without streaks, milestones from real events), Open-Meteo weather provider (keyless, cached, never throws), Symptom Weather estimate with localized contributing factors, "Tell my family" shares only the level, relax tile plays a guided wind-down in the browser voice, skeletons instead of demo data while loading; `node scripts/e2e-home.mjs`
- [x] Live Say it for me (section 4): `/api/translate` (fixed 3-tone sentence library x 4 languages, optional Claude rewrite validated with library fallback, red flags first), `/api/cards`; she plays/copies the sentence herself, the family only ever gets the enumerated card, with an exact preview in each person's language, approval tap, delivery status; `node scripts/e2e-translator.mjs`
- [x] Live Family & Privacy centre, Moments, Me, Discreet Mode (section 5): per-person permissions/pause/new link/revoke with confirmation, exact preview, add trusted person, per-purpose consents with history, server-enforced PIN lock (423 while locked, neutral lock screen and tab title, 5-try lockout, cover on blur), JSON export, audit trail, one-tap deletion that also kills family links, moments with the "it helped" tap feeding HUI, profile editing, sign out; `node scripts/e2e-privacy.mjs`
- [x] Live Doctor-Ready Brief (section 6): MRS scored by rules from her confirmed logs (11 items, 3 subscales with published cut-offs), localized content in 4 languages, English doctor copy + her-language view, 4-week timeline chart, rule-out questions ("Should we check...?", marked pending clinician review), Next 20 Years, one-page PDF (pdfkit, English), expiring + revocable doctor links (`/b/:token`, encrypted frozen snapshot, killed when consent is withdrawn), WhatsApp share; `node scripts/e2e-brief.mjs`
- [x] `npm run e2e:live` runs all real-browser suites (needs `npm run build:web` and `DEMO_AUTH=true npm start`)
- [x] `.env.example`
- [x] CI: typecheck, tests, safety suite, prototype build

## Check-in + Right Now (section 7)
- [x] One-tap mood check-in stored per day (counts as a check-in, fills the week strip, what she said outranks it), Right Now with real voice cues per breath phase, pause, repeat, a proper ending; `node scripts/e2e-checkin.mjs`
- [x] Dockerfile, docker-compose.yml, render.yaml, SETUP.md (all deployment files UNTESTED: no Docker/Render available here)

## Calmer voice + persistence (section 8)
- [x] Browser voice: rate 0.85, pitch 0.9, best natural voice picked per language (neural/natural/online preferred, wrong-language excluded), one sentence at a time with ~550 ms pauses; unit tests + `node scripts/e2e-voice.mjs`
- [x] Optional ElevenLabs TTS (`/api/tts`): key only in server env/.env (gitignored), stock calm voice settings (stability 0.75, speed 0.9, sentence pauses), cached, rate-limited, policy-checked, audited by provider only; falls back to browser voice on 501/502/offline/blocked audio. NOT tried against the real ElevenLabs API (no key here): request shape is unit-tested against a fake
- [x] Dev database now persists to `.data/pglite` (was in-memory), verified across a server restart

## Letters, 3 AM, Rehearsal, employer, admin (sections 9-10)
- [x] Letter to Myself: monthly, strengths-based, encrypted, built from confirmed logs (never her words), 4 languages, hourly idempotent job writes last month's on the 1st, optional share page (7 days, revocable, noindex); `node scripts/e2e-tools.mjs`
- [x] 3 AM Mode: dim, quiet, awake timer, spoken wind-down on request, her tap saves a night waking; Rehearsal Room: her own words (typed/spoken) + rule-based feedback (I-statement, clear ask, no blame, calm), crisis phrase gets the real crisis reply
- [x] Sakhi for Workplaces: k>=10 query layer (opt-in + live consent, rounding, complementary suppression, no ids/dates/text), HR access-code login, CSV export identical to the screen, employee opt-in/leave in the Privacy centre; `node scripts/e2e-hr.mjs`
- [x] Admin console: clinician-review register (all 23 items start "pending clinician review"; DB refuses "reviewed" without a named reviewer and date; new versions are unreviewed drafts), pilot analytics (research consent only, k>=10, targets labelled hypotheses), Symptom Atlas CSV; `node scripts/e2e-admin.mjs`
- [x] `npm run seed`: fictional Sunita household + Navrang Textiles (308 synthetic employees, two sites too small to show)
- [x] 317 unit/integration tests (vitest capped at 3 workers: each file boots its own embedded Postgres)

## PWA, offline, CI, docs (section 11)
- [x] Installable PWA: manifest + neutral "Notes" manifest/icons (swapped in Discreet Mode), service worker caches the shell and built assets only (never /api, /f, /b, /l), offline opens the app, Right Now / 3 AM / check-in work with no network and a signed-in user never sees demo data; offline check-ins queue (mood only) and sync when back online; CSP now allows blob audio; `node scripts/e2e-pwa.mjs`
- [x] `npm run check:i18n` (527 strings x 4 languages, placeholders consistent) wired into CI; CI workflow rewritten (typecheck, i18n, unit, safety, build, e2e on seeded data, docker build, audit). NOT run on GitHub Actions from here.
- [x] `npm run eval:speech` harness (honest: prints NOT A RESULT without ~20 real clips per language)
- [x] Docs: README, SETUP, DEPLOY, DECISIONS, SAFETY (validation plan), THREAT-MODEL, PRIVACY (with breach runbook)

## Missed-call line (section 12)
- [x] Telephony webhooks (`/webhooks/ivr/missed-call`, `/answer`, `/speech`; shared secret `IVR_WEBHOOK_SECRET`; JSON or Twilio-style XML): known number -> callback -> Right Now script in her language -> speech goes through the SAME safety pipeline; signed short-lived session so speech cannot be posted "as" someone else; nothing is saved or logged (no way to confirm by phone); crisis reply with helplines read digit by digit
- [x] In-app simulator (`#/missed-call`) calls the same handlers; `node scripts/e2e-ivr.mjs`. NOT tried against a real Twilio/Exotel account.

## Still the scripted prototype (works only on demo data, not connected to the API)
- [ ] Web Push + check-in reminders + Symptom Weather alerts (VAPID); the monthly Letter job exists, no other scheduler
- [ ] Seed script, `/demo` against the live API, Hindi + English screenshot run against the live app, `npm run eval:speech`
- [ ] Server speech-to-text providers (Sarvam/Google/Whisper): only the browser Web Speech API is used (typed fallback always works). Server TTS (ElevenLabs) exists, untried against the real API.
- [ ] CI is written but unverified on GitHub; no scheduled retention deletion
- [ ] Lighthouse/accessibility audit (not run), 1440px visual pass of the live app
- [ ] v1.0.0 tag (not tagged: the app is not complete)
