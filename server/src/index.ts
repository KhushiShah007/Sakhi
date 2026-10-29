import { dbFromEnv, migrate } from './db/index.js';
import { llmFromEnv } from './llm/provider.js';
import { buildApp } from './api/app.js';
import { serveStatic } from './api/static.js';
import { generateDueLetters } from './api/letters.js';
import { keyFromEnv } from './privacy/crypto.js';

const db = await dbFromEnv();
const applied = await migrate(db);
const app = await buildApp({ db, llm: llmFromEnv() }); // throws if NODE_ENV=production and DEMO_AUTH=true
// Monthly letters: idempotent, so an hourly tick means the first run after midnight on the 1st does the work (and a restart catches up).
const jobKey = keyFromEnv();
const tick = () => generateDueLetters(db, jobKey, new Date()).then((n) => n && console.log(`letters written: ${n}`)).catch((e) => console.error('letter job failed:', (e as Error).message));
void tick(); setInterval(tick, 3600_000).unref();
const served = serveStatic(app, process.env.STATIC_DIR || 'dist');
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`sakhi api on :${port} (migrations applied: ${applied.length}, llm: ${process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'rules'}, web: ${served ? 'served' : 'not built'})`);
