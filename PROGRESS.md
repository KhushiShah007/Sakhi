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

## Still the scripted prototype (works only on demo data, not connected to the API)
- [ ] Letter to Myself (needs generation + monthly job), Rehearsal Room (needs scenario turns), 3 AM Mode (needs awakening log), missed-call IVR page
- [ ] HR dashboard (k-anonymity helpers exist and are tested; no query layer or opt-in flow yet), admin console, pilot analytics, Symptom Atlas
- [ ] Web Push + reminders + scheduled jobs, PWA manifest + service worker + offline queue, alternate neutral manifest
- [ ] Seed script, `/demo` against the live API, Hindi + English screenshot run against the live app, `npm run eval:speech`
- [ ] Server speech providers (Sarvam/Google/Whisper), server TTS, telephony webhooks
- [ ] GitHub Actions: only typecheck/test/build today; e2e, audit gating, Docker build, deploy still to do; remaining docs (DEPLOY, SAFETY validation plan details, THREAT-MODEL, PRIVACY, breach runbook)
- [ ] Lighthouse/accessibility pass, translation-key CI check, 1440px visual pass
- [ ] v1.0.0 tag (not tagged: the app is not complete)
