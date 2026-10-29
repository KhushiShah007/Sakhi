# Setup

Sakhi runs with **zero keys**. Every integration below is optional and upgrades a built-in fallback when its variables are set.

## Run it (no Docker, no database to install)

```bash
npm install
npm run build:web
DEMO_AUTH=true npm start          # http://localhost:8787 : API + the web app, embedded Postgres (PGlite)
```
Sign in with any 10-digit number; the demo code is `123456`. Set `DEMO_MODE=true` to show a small DEMO badge.

Tests: `npm test` (unit/integration, 257 tests incl. the 80-prompt AI safety suite: `npm run test:safety`), and `npm run e2e:live` (real-browser suites; needs the server above running and `npx playwright install chromium` once).

## What each key unlocks

| Variable | Without it (fallback) | With it |
|---|---|---|
| `DATABASE_URL` | embedded PGlite (dev only; **required in production**) | real Postgres |
| `SAKHI_DATA_KEY` | deterministic dev key (**required in production**) | AES-256-GCM key for sensitive fields. `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `OTP_WEBHOOK_URL` (+ `OTP_WEBHOOK_TOKEN`) | only `DEMO_AUTH=true` can sign in | the server POSTs `{phone, code}` to your SMS gateway (MSG91, Twilio, Exotel...) |
| `ANTHROPIC_API_KEY` | rule-based extractor, reflections and sentence library in all 4 languages | Claude extracts symptoms and rephrases "Say it for me". Output is still validated by Zod and the blocklist, and rules still run first. Models: `SAKHI_MODEL_CHAT` (default `claude-sonnet-5-5`), `SAKHI_MODEL_EXTRACT` (default `claude-haiku-5-5`) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEMPLATE_CARD`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | the no-install family link page | cards sent on WhatsApp. See below |
| `WEATHER_PROVIDER=none` | Open-Meteo forecast + air quality, **no key needed** | turns the forecast off |
| `HELPLINES_JSON` | 112 and Tele-MANAS 14416 | your own helplines |
| `PUBLIC_URL` | derived from the request host | base for family and doctor links |
| `RATE_LIMIT_PER_MIN` | 120 per IP | tune |

### WhatsApp Cloud API
1. Create a Meta app and a WhatsApp Business number; copy the permanent token and phone-number ID.
2. Create a template named `sakhi_signal_card` (category *Utility*) per language (`hi`, `mr`, `gu`, `en`) with **one body variable** (`{{1}}`) and **two quick-reply buttons** ("Done", "Need help understanding"). Template approval is Meta's, not ours.
3. Webhook: `https://<host>/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, and set `WHATSAPP_APP_SECRET` so signatures are checked. Delivery status and quick replies are handled; the sender is only exercised against a fake Meta server in tests.

## Safety switches that cannot be turned off by mistake
- `DEMO_AUTH=true` with `NODE_ENV=production` makes the server refuse to start.
- Production without `DATABASE_URL` or `SAKHI_DATA_KEY` refuses to start.
