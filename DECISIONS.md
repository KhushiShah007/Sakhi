# Decisions

- **Built on the existing Vite prototype** (the brief allows building on the prototype's design system) instead of rewriting to Next.js. Re-evaluate when the API lands; Fastify is the planned API.
- **Safety core is pure TypeScript with no I/O** so it is unit-testable and reusable by app, WhatsApp and IVR channels.
- **Zod v4**; `z.partialRecord` for MRS scores.
- **Red flags over-trigger on purpose** (negations like "no chest pain" still trigger). Safe failure direction.
- **Crisis > policy > LLM** ordering; a message with both a jailbreak and self-harm gets the crisis reply.
- **Policy refusals also bypass the LLM.** The brief only requires this for crisis; bypassing here keeps refusals deterministic and testable.
- **Substring regexes, not `\b`,** because word boundaries are unreliable for Devanagari/Gujarati.
- **MRS from logs = max severity per item** in the window (simple, explainable); to be validated clinically.
- **Complementary suppression** hides the next-smallest visible group when exactly one group is suppressed.
- **Dev-only encryption key** is derived deterministically when `SAKHI_DATA_KEY` is unset and `NODE_ENV!=production`; production throws.
- **Tooling gaps in this environment**: no Docker, Postgres or `gh` installed, so DB-backed work could not be verified here.
- **DB**: Postgres dialect via SQL migrations; PGlite (embedded) for dev/tests, `pg` when `DATABASE_URL` is set. Chosen because Docker was unavailable; Prisma dropped for the same reason (revisit if desired).
- **Proposal sets live in server memory** (15-min TTL, single use, bound to user). Keeps her words out of the database. Trade-off: restart or multiple instances lose pending proposals; acceptable for confirm-within-minutes flow, move to Redis if scaled out.
- **Crisis replies skip consent and persistence** so help is never withheld and no crisis flag exists anywhere.
- **Audit log stores metadata only**; on account deletion its user_id is replaced by a hashed tombstone so the trail survives without identity.
- **OTP provider** is a generic webhook (`OTP_WEBHOOK_URL`) so any SMS gateway can be plugged in; no vendor SDK baked in.
