# Privacy (DPDP Act 2023 / DPDP Rules, Nov 2025: principles, not legal advice)

Sakhi is a wellness companion, **not a medical device**. This page says what is collected, why, for how long, and what she can do. It has not been reviewed by a lawyer; do that before any pilot.

## What is stored, and why (purpose limitation)
| Data | Purpose | Notes |
|---|---|---|
| Phone number | sign-in | HMAC-hashed for lookup and AES-GCM encrypted; never shown to family or HR |
| Year of birth | the 18+ gate, age on the brief | only the year is kept |
| Name, city, stage, language | greeting, weather, the brief | |
| Confirmed symptoms (symptom, severity, time, trigger) | her log, the brief, Symptom Weather, Letter | **never her words**; only what she tapped to confirm |
| Mood check-ins, night wakings | her log | one tap, no words |
| Family/trusted people (name, phone, language) | Signal Cards | names and phones encrypted |
| Signals sent and the family's replies | Household Understanding Index | enumerated card types only |
| Letters, doctor-link snapshots | her features | encrypted; expire/revocable |
| Consents (append-only history) | proof of choice | one row per grant or withdrawal |
| Audit log | she can see who accessed her data | metadata only, no content |

## What is NOT stored
Anything she says (transcripts), audio (processed in the browser; server speech providers are not built), crisis flags, the content of rehearsals, or the calm sentences from "Say it for me".

## Her rights (all in the Family & Privacy centre)
- **Per-purpose consent**, off unless she turns it on (optional ones), withdrawable any time; withdrawing stops the purpose immediately (logging, family signals, doctor brief, employer totals, research).
- **Access/export**: one tap downloads everything as JSON.
- **See access**: the audit trail, including each time a family link or doctor link was opened.
- **Erasure**: one tap deletes the account and all data, and every family link, doctor link and letter link stops working. The audit trail keeps only a hashed tombstone.
- **Under 18**: no account (birth year gate; nothing is stored). Teens appear only as content-only family members: no phone stored, no signals.

## Who sees what
- **Family**: enumerated cards, tomorrow's risk *level*, fixed lessons. Never her words.
- **Her doctor**: only a brief she shares, as a 7-day revocable link.
- **Employer**: only k≥10 aggregates, rounded, from people who opted in. See THREAT-MODEL.md for limits.
- **Researchers/admin**: only people who separately consented to research; k≥10; no identifiers.
- **Third-party processors (optional)**: Anthropic (if `ANTHROPIC_API_KEY`) receives what she typed/said for extraction; ElevenLabs (if `ELEVENLABS_API_KEY`) receives the app's own wording to voice; WhatsApp/Meta (if configured) receives the recipient phone and card text; Open-Meteo receives her city name. Each is off by default. Disclose these in the in-app notice before enabling.

## Retention
A scheduled job (`server/src/api/retention.ts`, at start and daily) deletes expired one-time codes, sessions, admin sessions and unconfirmed proposal sets; doctor/letter links 30 days after they expire; and confirmed logs older than `RETENTION_LOG_MONTHS` (default 24; `0` keeps them). The audit trail is kept because it holds no content. She can export or delete everything at any time.

## Breach runbook (draft, to be rehearsed)
1. **Contain** (first hour): rotate `SAKHI_DATA_KEY` only after re-encrypting (data would be unreadable otherwise), revoke all sessions (`DELETE FROM sessions`), rotate OTP/WhatsApp/ElevenLabs/Anthropic keys, take the app read-only.
2. **Assess** (24 h): use the audit log and server logs (no bodies are logged) to bound which accounts and fields were touched. Encrypted fields are only exposed if the key was.
3. **Notify**: the Data Protection Board and affected people as the DPDP Rules require (check current timelines with counsel); tell them what was exposed, the risk, and what to do. Offer deletion.
4. **Learn**: post-incident review; update THREAT-MODEL.md.
