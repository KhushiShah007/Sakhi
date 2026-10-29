import { dbFromEnv, migrate } from './db/index.js';
import { llmFromEnv } from './llm/provider.js';
import { buildApp } from './api/app.js';

const db = await dbFromEnv();
const applied = await migrate(db);
const app = await buildApp({ db, llm: llmFromEnv() }); // throws if NODE_ENV=production and DEMO_AUTH=true
const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
console.log(`sakhi api on :${port} (migrations applied: ${applied.length}, llm: ${process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'rules'})`);
