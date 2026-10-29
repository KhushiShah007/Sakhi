import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { migrate, pgliteDb } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';

// 19:00Z on the 29th is 00:30 IST on the 30th: the UTC date and the India date differ.
const clock = new Date('2026-10-29T19:00:00Z');
let app: FastifyInstance;
beforeAll(async () => { const db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env: { DEMO_AUTH: 'true', NODE_ENV: 'test', RATE_LIMIT_PER_MIN: '100000' } as NodeJS.ProcessEnv, now: () => clock, weather: noWeather, tts: null, push: null }); });
afterAll(async () => { await app.close(); });

describe('India time', () => {
  it('a shared weather alert is still shared on Home just after midnight IST', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919820000001' } });
    const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919820000001', code: '123456', birthYear: 1978, lang: 'en' } });
    const h = { cookie: String(v.headers['set-cookie']).split(';')[0], 'x-csrf-token': v.json().csrf };
    for (const purpose of ['core_logging', 'family_signals']) await app.inject({ method: 'POST', url: '/api/consents', headers: h, payload: { purpose, granted: true } });
    await app.inject({ method: 'PATCH', url: '/api/me', headers: h, payload: { name: 'S', onboarded: true } });
    expect((await app.inject({ method: 'POST', url: '/api/symptom-weather', headers: h, payload: { share: true } })).json().shared).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/home', headers: h })).json().weather.shared).toBe(true);
  });
});
