import { dbFromEnv, migrate } from './db/index.js';
import { llmFromEnv } from './llm/provider.js';
import { buildApp } from './api/app.js';
import { serveStatic } from './api/static.js';
import { generateDueLetters } from './api/letters.js';
import { keyFromEnv } from './privacy/crypto.js';
import { pushFromEnv } from './providers/push.js';
import { weatherFromEnv } from './providers/weather.js';
import { sendDueReminders } from './api/reminders.js';
import { purgeExpired } from './api/retention.js';
import { syncContent } from './api/admin.js';

const db = await dbFromEnv();
const applied = await migrate(db);
await syncContent(db); // registers the app's own wording in the clinician-review register (version 1, NOT reviewed)
const app = await buildApp({ db, llm: llmFromEnv() }); // throws if NODE_ENV=production and DEMO_AUTH=true
// Monthly letters: idempotent, so an hourly tick means the first run after midnight on the 1st does the work (and a restart catches up).
const jobKey = keyFromEnv();
const tick = () => generateDueLetters(db, jobKey, new Date()).then((n) => n && console.log(`letters written: ${n}`)).catch((e) => console.error('letter job failed:', (e as Error).message));
void tick(); setInterval(tick, 3600_000).unref();
const served = serveStatic(app, process.env.STATIC_DIR || 'dist');
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`sakhi api on :${port} (migrations applied: ${applied.length}, llm: ${process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'rules'}, web: ${served ? 'served' : 'not built'})`);

// Reminders: checked every minute; each is sent at most once a day and only between 08:00 and 21:00 India time.
const push = pushFromEnv(process.env);
if (push) { const w = weatherFromEnv(process.env); setInterval(() => sendDueReminders(db, jobKey, push, w, new Date()).catch((e) => console.error('reminder job failed:', (e as Error).message)), 60_000).unref(); }

// Retention: expired codes/sessions/proposals/links and logs older than RETENTION_LOG_MONTHS (default 24; 0 = keep). Runs at start and daily.
const purge = () => purgeExpired(db, new Date(), { logMonths: process.env.RETENTION_LOG_MONTHS === undefined ? 24 : Number(process.env.RETENTION_LOG_MONTHS) }).then((p) => Object.values(p).some(Boolean) && console.log('retention purge:', JSON.stringify(p))).catch((e) => console.error('retention job failed:', (e as Error).message));
void purge(); setInterval(purge, 86400_000).unref();
