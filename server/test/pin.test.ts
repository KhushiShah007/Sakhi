import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { checkPin, hashPin } from '../src/privacy/pin.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';

describe('pin hashing', () => {
  it('verifies the right PIN only, with a fresh salt each time, never storing the PIN', () => {
    const a = hashPin('4821'); const b = hashPin('4821');
    expect(a).not.toBe(b); expect(a).not.toContain('4821');
    expect(checkPin('4821', a)).toBe(true); expect(checkPin('4822', a)).toBe(false); expect(checkPin('', a)).toBe(false);
    expect(checkPin('4821', 'garbage')).toBe(false);
  });
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 2).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let clock = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather }); });
afterAll(async () => { await app.close(); await db.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  const s = { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
  for (const purpose of ['core_logging', 'family_signals']) await call(s, 'POST', '/api/consents', { purpose, granted: true });
  await call(s, 'PATCH', '/api/me', { name: 'Sunita', city: 'Pune', onboarded: true });
  return s;
}
const call = (s: S, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });

describe('Discreet Mode PIN lock (server enforced)', () => {
  it('rejects malformed PINs and cannot lock without a PIN', async () => {
    const s = await login('+919500000001');
    for (const pin of ['123', '1234567', 'abcd', '12 34']) expect((await call(s, 'POST', '/api/pin', { pin })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/lock')).statusCode).toBe(400);
  });

  it('set, lock: everything but /me, verify, lock, logout is refused, and /me reveals nothing about her', async () => {
    const s = await login('+919500000002');
    expect((await call(s, 'POST', '/api/pin', { pin: '4821' })).statusCode).toBe(200);
    const me = (await call(s, 'GET', '/api/me')).json();
    expect(me).toMatchObject({ hasPin: true, discreet: true, name: 'Sunita', age: 48 });
    expect(me).not.toHaveProperty('birth_year'); expect(JSON.stringify(me)).not.toContain('pin_hash');
    expect((await call(s, 'POST', '/api/lock')).statusCode).toBe(200);
    const locked = (await call(s, 'GET', '/api/me')).json();
    expect(locked).toMatchObject({ locked: true, hasPin: true }); expect(locked.name).toBeUndefined(); expect(locked.city).toBeUndefined();
    for (const [m, u] of [['GET', '/api/home'], ['GET', '/api/logs'], ['GET', '/api/people'], ['GET', '/api/export'], ['GET', '/api/moments'], ['POST', '/api/utterance'], ['DELETE', '/api/me'], ['PATCH', '/api/me'], ['DELETE', '/api/pin'], ['POST', '/api/pin']] as const)
      expect((await call(s, m, u, m === 'POST' || m === 'PATCH' ? { text: 'hi', pin: '1234', name: 'x' } : undefined)).statusCode, `${m} ${u}`).toBe(423);
    expect((await call(s, 'POST', '/api/pin/verify', { pin: '4821' })).statusCode).toBe(200);
    expect((await call(s, 'GET', '/api/home')).statusCode).toBe(200);
    expect((await call(s, 'GET', '/api/me')).json().locked).toBe(false);
  });

  it('wrong PINs count down, 5 misses lock PIN entry for 5 minutes, then it works again', async () => {
    const s = await login('+919500000003');
    await call(s, 'POST', '/api/pin', { pin: '1357' }); await call(s, 'POST', '/api/lock');
    const r1 = await call(s, 'POST', '/api/pin/verify', { pin: '0000' });
    expect(r1.statusCode).toBe(401); expect(r1.json()).toMatchObject({ error: 'wrong_pin', attemptsLeft: 4 });
    for (let i = 0; i < 3; i++) await call(s, 'POST', '/api/pin/verify', { pin: '0000' });
    const fifth = await call(s, 'POST', '/api/pin/verify', { pin: '0000' });
    expect(fifth.statusCode).toBe(429); expect(fifth.json().error).toBe('pin_locked');
    expect((await call(s, 'POST', '/api/pin/verify', { pin: '1357' })).statusCode).toBe(429); // even the right PIN waits
    clock = new Date(clock.getTime() + 5 * 60_000 + 1000);
    expect((await call(s, 'POST', '/api/pin/verify', { pin: '1357' })).statusCode).toBe(200);
    clock = new Date('2026-10-29T10:00:00Z');
  });

  it('changing the PIN needs the current one; removing needs it too and frees locked sessions', async () => {
    const s = await login('+919500000004');
    await call(s, 'POST', '/api/pin', { pin: '1111' });
    expect((await call(s, 'POST', '/api/pin', { pin: '2222' })).statusCode).toBe(401);
    expect((await call(s, 'POST', '/api/pin', { pin: '2222', currentPin: '1111' })).statusCode).toBe(200);
    await call(s, 'POST', '/api/lock'); await call(s, 'POST', '/api/pin/verify', { pin: '2222' });
    expect((await call(s, 'DELETE', '/api/pin', { pin: '9999' })).statusCode).toBe(401);
    expect((await call(s, 'DELETE', '/api/pin', { pin: '2222' })).statusCode).toBe(200);
    expect((await call(s, 'GET', '/api/me')).json().hasPin).toBe(false);
  });

  it('PIN is audited by event only, and never stored in the clear', async () => {
    const s = await login('+919500000005');
    await call(s, 'POST', '/api/pin', { pin: '7391' });
    expect(JSON.stringify(await db.query('SELECT * FROM audit_log'))).not.toContain('7391');
    expect(JSON.stringify(await db.query('SELECT pin_hash FROM users'))).not.toContain('7391');
  });

  it('another session of the same user is not locked by this one', async () => {
    const s = await login('+919500000006');
    await call(s, 'POST', '/api/pin', { pin: '2468' });
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919500000006' } });
    const r2 = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919500000006', code: '123456' } });
    const s2 = { cookie: String(r2.headers['set-cookie']).split(';')[0], csrf: r2.json().csrf };
    await call(s, 'POST', '/api/lock');
    expect((await call(s, 'GET', '/api/home')).statusCode).toBe(423);
    expect((await call(s2, 'GET', '/api/home')).statusCode).toBe(200);
  });
});

describe('moments and per-person last signal', () => {
  it('lists days she spoke (symptoms only) and signals with delivery state; people show their last signal', async () => {
    const s = await login('+919500000010');
    const u = (await call(s, 'POST', '/api/utterance', { text: 'hot flashes and very tired, secret words here', lang: 'en' })).json();
    await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true })) });
    await call(s, 'POST', '/api/people', { name: 'Rajesh', herLabel: 'Sunita', role: 'husband', lang: 'hi' });
    expect((await call(s, 'GET', '/api/people')).json().people[0].lastSignal).toBeNull();
    await call(s, 'POST', '/api/signals', { cardType: 'take_over_dinner' });
    const items = (await call(s, 'GET', '/api/moments')).json().items;
    expect(items.map((i: { kind: string }) => i.kind).sort()).toEqual(['signal', 'vent']);
    const sig = items.find((i: { kind: string }) => i.kind === 'signal');
    expect(sig).toMatchObject({ card: 'take_over_dinner', person: 'Rajesh', status: 'new', helped: false });
    const vent = items.find((i: { kind: string }) => i.kind === 'vent');
    expect(vent.symptoms.length).toBeGreaterThan(0); expect(JSON.stringify(items)).not.toContain('secret words');
    expect((await call(s, 'GET', '/api/people')).json().people[0].lastSignal).toMatchObject({ type: 'take_over_dinner', status: 'new' });
    expect((await call(s, 'POST', `/api/signals/${sig.id}/helped`)).statusCode).toBe(200);
    expect((await call(s, 'GET', '/api/moments')).json().items.find((i: { kind: string }) => i.kind === 'signal').helped).toBe(true);
  });
  it('is private to the user', async () => {
    const a = await login('+919500000011'); const b = await login('+919500000012');
    await call(a, 'POST', '/api/people', { name: 'X', herLabel: 'A', role: 'husband', lang: 'en' }); await call(a, 'POST', '/api/signals', { cardType: 'need_space' });
    expect((await call(b, 'GET', '/api/moments')).json().items).toEqual([]);
  });
});
