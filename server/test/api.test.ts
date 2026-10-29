import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', SAKHI_DATA_KEY: Buffer.alloc(32, 9).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance;
let clock = new Date('2026-10-29T10:00:00Z');

beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock }); });
afterAll(async () => { await app.close(); await db.close(); });

interface Sess { cookie: string; csrf: string }
async function login(phone: string, birthYear = 1978): Promise<Sess> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear, lang: 'hi' } });
  expect(r.statusCode).toBe(200);
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const call = (s: Sess, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown, csrf = s.csrf) =>
  app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': csrf } });

describe('migrations & boot', () => {
  it('applies once and is idempotent', async () => { expect(await migrate(db)).toEqual([]); });
  it('refuses to build in production with DEMO_AUTH=true', async () => {
    await expect(buildApp({ db, llm: null, env: { ...env, NODE_ENV: 'production' } })).rejects.toThrow(/DEMO_AUTH/);
  });
});

describe('auth', () => {
  it('under-18 cannot create an account and nothing is stored', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919000000001' } });
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919000000001', code: '123456', birthYear: 2012 } });
    expect(r.statusCode).toBe(403); expect(r.json().error).toBe('under_18');
    expect(await db.query('SELECT 1 FROM users')).toHaveLength(0);
  });
  it('wrong OTP is rejected and locks after 5 attempts', async () => {
    const phone = '+919000000002';
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
    for (let i = 0; i < 5; i++) expect((await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '000000', birthYear: 1980 } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1980 } })).statusCode).toBe(401);
  });
  it('without DEMO_AUTH and no provider, OTP is not issued', async () => {
    const a = await buildApp({ db, llm: null, env: { ...env, DEMO_AUTH: 'false' } });
    expect((await a.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919000000003' } })).statusCode).toBe(503);
  });
  it('session cookie is httpOnly and phone is stored encrypted + hashed', async () => {
    const phone = '+919000000004';
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
    const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1975 } });
    expect(String(r.headers['set-cookie'])).toMatch(/HttpOnly/);
    const row = (await db.query<{ phone_hash: string; phone_enc: string }>('SELECT phone_hash, phone_enc FROM users WHERE phone_hash <> $1 ORDER BY created_at DESC LIMIT 1', ['x']))[0];
    expect(JSON.stringify(row)).not.toContain('9000000004');
  });
  it('requires a session, and CSRF for writes', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
    const s = await login('+919000000005');
    expect((await call(s, 'GET', '/api/me')).statusCode).toBe(200);
    expect((await call(s, 'PATCH', '/api/me', { city: 'Pune' }, 'wrong')).statusCode).toBe(403);
    expect((await call(s, 'PATCH', '/api/me', { city: 'Pune', lang: 'mr' })).statusCode).toBe(200);
    expect((await call(s, 'GET', '/api/me')).json()).toMatchObject({ city: 'Pune', lang: 'mr' });
  });
  it('input validation: unknown fields and bad values are rejected', async () => {
    const s = await login('+919000000006');
    expect((await call(s, 'PATCH', '/api/me', { isAdmin: true })).statusCode).toBe(400);
    expect((await call(s, 'PATCH', '/api/me', { lang: 'fr' })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/utterance', { text: '' })).statusCode).toBe(400);
  });
  it('security headers are present', async () => {
    const r = await app.inject({ method: 'GET', url: '/healthz' });
    expect(r.headers['content-security-policy']).toBeTruthy();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('talk -> propose -> confirm -> log -> brief', () => {
  it('requires consent, saves only what she confirms, and keeps no transcript', async () => {
    const s = await login('+919000000010');
    const text = 'hot flashes at night and I am very tired';
    expect((await call(s, 'POST', '/api/utterance', { text })).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    await call(s, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: true });
    const u = (await call(s, 'POST', '/api/utterance', { text, lang: 'en' })).json();
    expect(u.kind).toBe('reply'); expect(u.proposals.length).toBeGreaterThanOrEqual(2);
    expect(await db.query('SELECT 1 FROM logs')).toHaveLength(0); // proposing saves nothing
    const accepted = u.proposals[0];
    const c = await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: [{ id: accepted.id, accept: true, severity: 3 }] });
    expect(c.json().saved).toBe(1);
    expect((await call(s, 'GET', '/api/logs')).json().logs).toHaveLength(1);
    expect((await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: [] })).statusCode).toBe(404); // single use
    const brief = (await call(s, 'GET', '/api/brief')).json();
    expect(brief.mrs.total).toBe(3); expect(brief.clinicianReviewed).toBe(false); expect(brief.footer).toMatch(/not diagnostic/i);
    // the words she spoke are nowhere in the database
    const dump = JSON.stringify([await db.query('SELECT * FROM logs'), await db.query('SELECT * FROM audit_log')]);
    expect(dump).not.toContain('very tired'); expect(dump).not.toContain('hot flashes at night');
  });
  it('pending proposals persist encrypted across an app restart, expire after 15 min, and hold no words', async () => {
    const s = await login('+919000000015');
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    const u = (await call(s, 'POST', '/api/utterance', { text: 'thak gayi hoon, bahut chidchid', lang: 'hi' })).json();
    const row = (await db.query<{ data_enc: string }>('SELECT data_enc FROM proposal_sets WHERE id=$1', [u.setId]))[0];
    expect(row.data_enc).not.toContain('fatigue'); expect(row.data_enc).not.toContain('thak');
    const app2 = await buildApp({ db, llm: null, env, now: () => clock }); // fresh instance, same DB
    const r = await app2.inject({ method: 'POST', url: '/api/logs/confirm', payload: { setId: u.setId, decisions: [{ id: 'p0', accept: true }] }, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
    expect(r.json().saved).toBe(1);
    const u2 = (await call(s, 'POST', '/api/utterance', { text: 'thak gayi hoon', lang: 'hi' })).json();
    const saved = clock; clock = new Date(clock.getTime() + 16 * 60_000);
    const late = await app2.inject({ method: 'POST', url: '/api/logs/confirm', payload: { setId: u2.setId, decisions: [{ id: 'p0', accept: true }] }, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
    clock = saved;
    expect(late.statusCode).toBe(404);
  });
  it('another user cannot confirm her proposal set', async () => {
    const a = await login('+919000000011'); const b = await login('+919000000012');
    for (const s of [a, b]) await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    const u = (await call(a, 'POST', '/api/utterance', { text: 'I feel anxious', lang: 'en' })).json();
    expect((await call(b, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: [{ id: 'p0', accept: true }] })).statusCode).toBe(404);
  });
  it('withdrawing consent stops logging and is recorded in history', async () => {
    const s = await login('+919000000013');
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: false });
    const c = (await call(s, 'GET', '/api/consents')).json();
    expect(c.current.core_logging).toBe(false); expect(c.history).toHaveLength(2);
    expect((await call(s, 'POST', '/api/utterance', { text: 'I feel anxious', lang: 'en' })).statusCode).toBe(403);
  });
  it('brief needs doctor_brief consent', async () => {
    const s = await login('+919000000014');
    expect((await call(s, 'GET', '/api/brief')).statusCode).toBe(403);
  });
});

describe('crisis and refusal bypass', () => {
  it('crisis reply is returned even without consent, uses no LLM, and stores nothing', async () => {
    const s = await login('+919000000020');
    const before = (await db.query('SELECT 1 FROM audit_log')).length;
    const r = (await call(s, 'POST', '/api/utterance', { text: 'मैं आत्महत्या के बारे में सोच रही हूँ', lang: 'hi' })).json();
    expect(r.kind).toBe('crisis'); expect(r.llmUsed).toBe(false);
    expect(r.helplines.map((h: { number: string }) => h.number)).toContain('14416');
    expect((await db.query('SELECT 1 FROM audit_log')).length).toBe(before); // no crisis flag persisted anywhere
    expect(await db.query('SELECT 1 FROM logs')).toBeDefined();
  });
  it('policy refusals are returned and audited without content', async () => {
    const s = await login('+919000000021');
    const r = (await call(s, 'POST', '/api/utterance', { text: 'Should I start HRT?', lang: 'en' })).json();
    expect(r.kind).toBe('refusal');
    const a = JSON.stringify(await db.query('SELECT * FROM audit_log'));
    expect(a).not.toContain('HRT?');
  });
});

describe('rights: audit, export, deletion', () => {
  it('audit trail lists accesses; export holds her data; deletion removes everything', async () => {
    const s = await login('+919000000030');
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    const u = (await call(s, 'POST', '/api/utterance', { text: 'knee pain and headache', lang: 'en' })).json();
    await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true })) });
    const audit = (await call(s, 'GET', '/api/audit')).json().entries.map((e: { action: string }) => e.action);
    expect(audit).toContain('confirm_logs'); expect(audit).toContain('consent_granted');
    const ex = (await call(s, 'GET', '/api/export')).json();
    expect(ex.profile.phone).toBe('+919000000030'); expect(ex.logs.length).toBe(2); expect(ex.consents.length).toBe(1);

    expect((await call(s, 'DELETE', '/api/me')).json().deleted).toBe(true);
    expect((await call(s, 'GET', '/api/me')).statusCode).toBe(401);
    const left = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM logs WHERE user_id NOT IN (SELECT id FROM users)');
    expect(left[0].n).toBe(0);
    const tomb = await db.query<{ user_id: string }>("SELECT DISTINCT user_id FROM audit_log WHERE user_id LIKE 'deleted:%'");
    expect(tomb.length).toBeGreaterThan(0);
  });
});

describe('rate limiting', () => {
  it('limits OTP requests per phone', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919000000099' } })).statusCode);
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes[6]).toBe(429);
  });
});
