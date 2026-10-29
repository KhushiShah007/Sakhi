import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { confirmEntries } from '../src/safety/pipeline.js';

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 3).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance;
const clock = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock }); });
afterAll(async () => { await app.close(); await db.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978 } });
  const s = { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
  for (const purpose of ['core_logging', 'family_signals']) await call(s, 'POST', '/api/consents', { purpose, granted: true });
  return s;
}
const call = (s: S, method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const logOne = async (s: S, text: string, extra: object = {}) => {
  const u = (await call(s, 'POST', '/api/utterance', { text, lang: 'en' })).json();
  await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true, ...extra })) });
  return u;
};

describe('time and trigger are persisted with confirmed logs', () => {
  it('stores the proposed time and trigger', async () => {
    const s = await login('+919200000001');
    const u = await logOne(s, 'so much stress at work, I feel anxious tonight');
    expect(u.proposals[0]).toMatchObject({ trigger: 'stress', time: 'night' });
    const row = (await db.query<{ time_of_day: string; trigger: string }>('SELECT time_of_day, trigger FROM logs'))[0];
    expect(row).toEqual({ time_of_day: 'night', trigger: 'stress' });
  });
  it('she can correct the trigger and time before saving', async () => {
    const s = await login('+919200000002');
    await logOne(s, 'I feel anxious tonight, stress again', { trigger: 'family', time: 'morning' });
    const logs = (await call(s, 'GET', '/api/logs')).json().logs;
    expect(logs[0]).toMatchObject({ trigger: 'family', time: 'morning' });
  });
  it('rejects values outside the fixed vocabulary', async () => {
    const s = await login('+919200000003');
    const u = (await call(s, 'POST', '/api/utterance', { text: 'I feel anxious', lang: 'en' })).json();
    const r = await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: [{ id: 'p0', accept: true, trigger: 'my mother in law is a witch' }] });
    expect(r.statusCode).toBe(400);
  });
  it('confirmEntries ignores an out-of-vocabulary trigger and keeps the proposal', () => {
    const logs = confirmEntries([{ id: 'p0', symptom: 'anxiety', severity: 2, time: 'night', trigger: 'work', mrsItem: 'anxiety', status: 'proposed' }], [{ id: 'p0', accept: true, trigger: 'bogus' as never }]);
    expect(logs[0].trigger).toBe('work');
  });
  it('the export includes time and trigger', async () => {
    const s = await login('+919200000004');
    await logOne(s, 'headache, so much tension');
    expect((await call(s, 'GET', '/api/export')).json().logs[0]).toMatchObject({ trigger: 'stress' });
  });
});

describe('Symptom Weather uses stress triggers', () => {
  it('stress days raise the score and are listed as a factor; no stress means no such factor', async () => {
    const calm = await login('+919200000010');
    await logOne(calm, 'hot flashes today');
    const a = (await call(calm, 'POST', '/api/symptom-weather', { tempC: 25 })).json();
    expect(a.factors.some((f: { label: string }) => /stress/i.test(f.label))).toBe(false);

    const tense = await login('+919200000011');
    await logOne(tense, 'hot flashes today, so much stress');
    const b = (await call(tense, 'POST', '/api/symptom-weather', { tempC: 25 })).json();
    expect(b.factors.some((f: { label: string }) => /stress/i.test(f.label))).toBe(true);
    expect(b.score).toBeGreaterThan(a.score);
    expect(b.score).toBe(b.factors.reduce((x: number, f: { points: number }) => x + f.points, 0)); // still fully explainable
  });
});

describe('request bodies', () => {
  it('accepts bodyless requests that carry a JSON content-type, and rejects malformed JSON', async () => {
    const s = await login('+919200000020');
    const headers = { cookie: s.cookie, 'x-csrf-token': s.csrf, 'content-type': 'application/json' };
    expect((await app.inject({ method: 'GET', url: '/api/me', headers })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/consents', headers, payload: '{bad' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'DELETE', url: '/api/me', headers })).statusCode).toBe(200);
  });
});

describe('profile', () => {
  it('stores name and onboarded flag', async () => {
    const s = await login('+919200000030');
    expect((await call(s, 'GET', '/api/me')).json()).toMatchObject({ name: null, onboarded: false });
    await app.inject({ method: 'PATCH', url: '/api/me', payload: { name: 'Sunita', onboarded: true, stage: 'perimenopause', city: 'Pune' }, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
    expect((await call(s, 'GET', '/api/me')).json()).toMatchObject({ name: 'Sunita', onboarded: true, stage: 'perimenopause', city: 'Pune' });
  });
});
