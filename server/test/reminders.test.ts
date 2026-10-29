import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { COPY, inSendWindow, sendDueReminders } from '../src/api/reminders.js';
import { LANGS } from '../src/config.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { keyFromEnv } from '../src/privacy/crypto.js';
import type { PushProvider, PushResult, PushSub } from '../src/providers/push.js';
import { noWeather } from '../src/providers/weather.js';
import { violatesOutputPolicy } from '../src/safety/validate.js';

class FakePush implements PushProvider {
  name = 'fake'; publicKey = 'PUB'; sent: { sub: PushSub; body: string }[] = []; result: PushResult = 'sent';
  async send(sub: PushSub, p: { title: string; body: string; url: string }) { this.sent.push({ sub, body: p.body }); return this.result; }
}
// IST = UTC+5:30, so 04:30Z is 10:00 IST
const at = (hmUtc: string) => new Date(`2026-10-29T${hmUtc}:00Z`);
let clock = at('04:30'); let db: Db; let app: FastifyInstance; const push = new FakePush();
const env = { DEMO_AUTH: 'true', NODE_ENV: 'test', RATE_LIMIT_PER_MIN: '100000' } as NodeJS.ProcessEnv;
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather, tts: null, push }); });
afterAll(async () => { await app.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const call = (s: S, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const sub = (n: string) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'p', auth: 'a' } });

describe('reminder wording and hours', () => {
  it('says nothing about her health, in 4 languages, and passes the output policy', () => {
    for (const k of ['checkin', 'weather'] as const) for (const l of LANGS) {
      const { title, body } = COPY[k][l];
      expect(body.length).toBeGreaterThan(10); expect(violatesOutputPolicy(`${title} ${body}`)).toBe(false);
      expect(body).not.toMatch(/hot flash|symptom|menopaus/i);
    }
  });
  it('only sends between 08:00 and 21:00 India time', () => {
    expect(inSendWindow(at('02:29'))).toBe(false); // 07:59
    expect(inSendWindow(at('02:30'))).toBe(true);  // 08:00
    expect(inSendWindow(at('15:29'))).toBe(true);  // 20:59
    expect(inSendWindow(at('15:30'))).toBe(false); // 21:00
    expect(inSendWindow(at('21:30'))).toBe(false); // 03:00 IST: the 3 AM hour never gets a notification
  });
});

describe('reminders API and sender', () => {
  it('is off by default, refuses hours outside the window, and needs a login', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/reminders' })).statusCode).toBe(401);
    const s = await login('+919810000001');
    expect((await call(s, 'GET', '/api/reminders')).json()).toMatchObject({ checkinOn: false, weatherOn: false, devices: 0, available: true });
    expect((await call(s, 'PUT', '/api/reminders', { checkinOn: true, checkinTime: '23:00', weatherOn: false })).statusCode).toBe(400);
    expect((await call(s, 'PUT', '/api/reminders', { checkinOn: true, checkinTime: '03:00', weatherOn: false })).statusCode).toBe(400);
  });
  it('sends the check-in reminder once a day at her time, with a neutral message, to every device', async () => {
    const s = await login('+919810000002');
    expect((await call(s, 'POST', '/api/push/subscribe', { subscription: sub('a') })).statusCode).toBe(200);
    expect((await call(s, 'POST', '/api/push/subscribe', { subscription: sub('b') })).statusCode).toBe(200);
    expect((await call(s, 'POST', '/api/push/subscribe', { subscription: { ...sub('c'), endpoint: 'http://insecure.example/c' } })).statusCode).toBe(400);
    await call(s, 'PUT', '/api/reminders', { checkinOn: true, checkinTime: '10:00', weatherOn: false });
    const key = keyFromEnv();
    expect(await sendDueReminders(db, key, push, noWeather, at('04:00'))).toBe(0); // 09:30, too early
    push.sent = [];
    expect(await sendDueReminders(db, key, push, noWeather, at('04:35'))).toBe(1); // 10:05
    expect(push.sent.map((x) => x.sub.endpoint).sort()).toEqual(['https://push.example/a', 'https://push.example/b']);
    expect(push.sent[0].body).toBe(COPY.checkin.en.body);
    expect(await sendDueReminders(db, key, push, noWeather, at('04:40'))).toBe(0); // not twice in a day
    const stored = (await db.query<{ sub_enc: string }>('SELECT sub_enc FROM push_subscriptions'))[0].sub_enc;
    expect(stored).not.toContain('push.example'); // device addresses are stored encrypted
  });
  it('never sends outside the window even if due', async () => {
    const s = await login('+919810000003');
    await call(s, 'POST', '/api/push/subscribe', { subscription: sub('d') });
    await call(s, 'PUT', '/api/reminders', { checkinOn: true, checkinTime: '20:30', weatherOn: false });
    push.sent = [];
    expect(await sendDueReminders(db, keyFromEnv(), push, noWeather, at('15:45'))).toBe(0); // 21:15 IST
    expect(push.sent).toHaveLength(0);
  });
  it('removes a device the push service says is gone, and lets her unsubscribe', async () => {
    const s = await login('+919810000004');
    await call(s, 'POST', '/api/push/subscribe', { subscription: sub('e') });
    await call(s, 'PUT', '/api/reminders', { checkinOn: true, checkinTime: '10:00', weatherOn: false });
    push.result = 'gone';
    expect(await sendDueReminders(db, keyFromEnv(), push, noWeather, at('04:35'))).toBe(0);
    expect((await call(s, 'GET', '/api/reminders')).json().devices).toBe(0);
    push.result = 'sent';
    await call(s, 'POST', '/api/push/subscribe', { subscription: sub('f') });
    expect((await call(s, 'GET', '/api/reminders')).json().devices).toBe(1);
    await call(s, 'POST', '/api/push/unsubscribe', { endpoint: sub('f').endpoint });
    expect((await call(s, 'GET', '/api/reminders')).json().devices).toBe(0);
  });
  it('without VAPID keys it says so and refuses subscriptions', async () => {
    const off = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather, tts: null, push: null });
    await off.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919810000005' } });
    const v = await off.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919810000005', code: '123456', birthYear: 1978, lang: 'en' } });
    const h = { cookie: String(v.headers['set-cookie']).split(';')[0], 'x-csrf-token': v.json().csrf };
    expect((await off.inject({ method: 'GET', url: '/api/push/config', headers: h })).json()).toEqual({ enabled: false, publicKey: null });
    expect((await off.inject({ method: 'POST', url: '/api/push/subscribe', headers: h, payload: { subscription: sub('x') } })).statusCode).toBe(501);
    await off.close();
  });
});
