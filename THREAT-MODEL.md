# Threat model

Sakhi holds health-adjacent data about women, inside households where the main risk is often **someone close to her**, not an anonymous attacker. This document lists what the design defends against, how, and what it does **not** defend against.

## 1. Household misuse (partner or family coercion)
| Threat | Defence | Limit |
|---|---|---|
| A family member reads her words | Words are never stored. Family sees only the five enumerated Signal Cards, a risk *level*, and fixed lessons. `signals` has no text column; a test asserts her words appear nowhere in the family page, the export or the database. | If someone watches her phone while she speaks, nothing can help. |
| Coerced sharing ("show me what it says") | The only things that can be shown are the confirmed symptom list, check-ins, and the brief. The preview screen shows exactly what family sees. Doctor links and letter links expire (7 days) and she can revoke them. | Someone who knows her phone PIN and her number can read her logs. |
| A family link is forwarded | Links are unguessable bearer tokens (24 random bytes, hash stored), revocable, rotatable; paused/revoked/unknown all answer the same 410. | Whoever holds a live link sees that person's view (cards + lessons). Teens are content-only. |
| Pressure to prove she "is using it" | Check-ins are optional; no streak counters, nothing is reported to family beyond cards she chooses to send. | — |
| Domestic violence disclosure | Abuse phrases trigger a scripted reply with helplines, **nothing is stored and no flag exists** anywhere family, HR or admin could see. | A helpline call on a shared phone may show in call logs. |

## 2. Shared phones
- **Discreet Mode**: neutral name ("Notes"), neutral icon and installed-app manifest, neutral notification wording (no push is built yet), PIN lock **enforced on the server** (a locked session gets 423 on everything except identity, PIN entry, lock and sign-out; matched by method and path after a test caught a path-only list), 5 wrong PINs lock entry for 5 minutes, page blanked on blur, re-lock after 60 s away.
- **Limits, stated plainly**: a 4-digit PIN is only 10,000 possibilities; the lockout slows guessing but a determined person with the phone and time is a risk. A web page cannot control what the OS app switcher snapshots (a native wrapper with FLAG_SECURE would be needed). The service worker caches the app shell only, never data; the browser's own history still shows that the site was visited.

## 3. HR re-identification
- Only people who opt in **and** whose consent is currently granted are counted; withdrawal removes them at once.
- Under 10 participants anywhere → everything hidden. Any group/theme under 10 hidden. Complementary suppression so a hidden group cannot be recovered by "total minus the rest". The combined "other" is only shown when it is itself ≥ 10.
- Counts and percentages are rounded to 5, so one joiner/leaver rarely moves a number.
- Nothing individual leaves the query layer (tests scan the output for ids, hashes, dates, symptom keys); the CSV is generated from the same suppressed object.
- **Limits**: rounding does not stop a patient analyst correlating many snapshots over time (a differencing attack across rounding boundaries), or an employer who knows a site has 11 participants and that 2 are on leave. HR cannot see who opted in, but the employer invite code is shared widely. Treat this as strong aggregate protection, not a formal differential-privacy guarantee. A future version should add noise and a cooldown between snapshots.

## 4. Account and infrastructure
- Auth: phone OTP (5 attempts, 5-minute expiry, rate limited), httpOnly SameSite=Lax session cookie, CSRF double-submit on every write, per-IP and per-action rate limits. `DEMO_AUTH=true` makes the server refuse to start in production.
- At rest: phone, family names/phones, pending proposals, doctor-link snapshots and letters are AES-256-GCM with the owner bound in as associated data (a value copied to another row fails to decrypt). Phone is also HMAC-hashed for lookup. PIN is scrypt.
- Headers: strict CSP (self + blob audio, no remote scripts, no framing), nosniff, no-referrer, HSTS in production, `no-store` on API responses.
- Logging: the server never logs request bodies; the audit log stores who/what/when, never content.
- Secrets only via environment; `.env` is gitignored; ElevenLabs/Anthropic/WhatsApp keys stay server-side.
- **Not covered / not done**: no penetration test; dependency audit shows 2 moderate advisories in React Router's SSR path (unused); admin and HR use shared access codes rather than named accounts with MFA; no WAF; backups, key rotation and a tested breach drill are on the operator (see PRIVACY.md runbook).

## 5. AI-specific
- Crisis and policy rules run **before** the LLM and bypass it. The LLM never writes to her log; every entry is confirmed by her. Outputs pass a blocklist (doses, diagnoses, guarantees, HRT advice). User text is wrapped as data in the prompt.
- **Limit**: rules are keyword-based and will miss unusual phrasings and misspellings; the 80-prompt suite proves the rules fire on those prompts, not that they catch every real utterance. Speech-recognition errors can mask a crisis phrase. Treat the red-flag list as a first line, to be validated with clinicians and real speech.
