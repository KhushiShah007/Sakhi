# Progress

Honest status. The full brief is far larger than one session; this file says exactly what exists.

## Done (tested: `npm test`, 122 tests; `npm run test:safety`)
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
- [x] CI: typecheck, tests, safety suite, prototype build

## Not started (needs a database, Docker, accounts or substantial UI work)
- [ ] API server (Fastify), Postgres schema/migrations, auth + OTP, sessions/CSRF/rate limits, audit log, consent records
- [ ] STT/TTS/weather/WhatsApp/IVR/push providers (interfaces + fallbacks)
- [ ] Wiring the existing screens to the API (they still use mock data)
- [ ] Family link pages, webhooks, HUI, HR query layer, admin console, pilot analytics
- [ ] Brief PDF export, scheduled jobs, PWA/offline, Discreet Mode lock
- [ ] Seed, Playwright e2e, Lighthouse, Docker, render.yaml, remaining docs
- [ ] GitHub release v1.0.0 (not tagged: the app is not complete)
