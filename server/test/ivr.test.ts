import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { rightNowScript, toTwiml } from '../src/api/ivr.js';
import { LANGS } from '../src/config.js';
import { IVR } from '../src/content/ivr.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';

const SECRET = 'ivr-shared-secret';
const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', IVR_WEBHOOK_SECRET: SECRET, PUBLIC_URL: 'https://sakhi.test', SAKHI_DATA_KEY: Buffer.alloc(32, 6).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let off: FastifyInstance; let clock = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather, tts: null }); off = await buildApp({ db, llm: null, env: { ...env, IVR_WEBHOOK_SECRET: '' }, now: () => clock, weather: noWeather, tts: null }); });
afterAll(async () => { await app.close(); await off.close(); await db.close(); });
const H = { 'x-ivr-secret': SECRET };

describe('call script', () => {
  it('is complete in all 4 languages, with three slow breaths and a prompt', () => {
    for (const l of LANGS) for (const v of Object.values(IVR)) expect(v[l].length, l).toBeGreaterThan(5);
    const s = rightNowScript('en');
    expect(s.filter((x) => x.text === 'Breathe in.').length).toBe(3);
    expect(s.reduce((a, x) => a + x.pauseMs, 0)).toBeGreaterThanOrEqual(36_000);
  });
  it('renders valid call-flow XML, escaping text', () => {
    const x = toTwiml({ say: [{ text: 'A & B <c>', pauseMs: 2000 }], gather: { input: 'speech', lang: 'hi', action: 'https://x/y?a=1&b=2' }, hangup: false }, 'hi');
    expect(x).toContain('<Say language="hi-IN">A &amp; B &lt;c&gt;</Say><Pause length="2"/>');
    expect(x).toContain('<Gather input="speech" language="hi-IN"'); expect(x).toContain('a=1&amp;b=2'); expect(x.startsWith('<?xml')).toBe(true);
  });
});

async function user(phone: string, lang = 'hi') {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang } });
  const h = { cookie: String(v.headers['set-cookie']).split(';')[0], 'x-csrf-token': v.json().csrf };
  await app.inject({ method: 'POST', url: '/api/consents', headers: h, payload: { purpose: 'core_logging', granted: true } });
  await app.inject({ method: 'PATCH', url: '/api/me', headers: h, payload: { onboarded: true } });
  return h;
}
const missed = (from: string, headers: Record<string, string> = H) => app.inject({ method: 'POST', url: '/webhooks/ivr/missed-call', payload: { from }, headers });
const sessionOf = async (phone: string) => decodeURIComponent((await missed(phone)).json().answerUrl.split('session=')[1]);
const speech = (session: string, payload: object) => app.inject({ method: 'POST', url: `/webhooks/ivr/speech?session=${encodeURIComponent(session)}`, headers: H, payload });
const said = (r: { say: { text: string }[] }) => r.say.map((s) => s.text).join(' ');

describe('telephony webhooks', () => {
  it('refuse everything without the shared secret (and say so when none is configured)', async () => {
    expect((await off.inject({ method: 'POST', url: '/webhooks/ivr/missed-call', payload: { from: '+919800010001' }, headers: H })).statusCode).toBe(503);
    expect((await missed('+919800010001', {})).statusCode).toBe(401);
    expect((await missed('+919800010001', { 'x-ivr-secret': 'wrong' })).statusCode).toBe(401);
  });
  it('a missed call from a known number triggers a callback; an unknown number does not', async () => {
    await user('+919800010002');
    const known = (await missed('+919800010002')).json();
    expect(known.callback).toBe(true); expect(known.answerUrl).toMatch(/^https:\/\/sakhi\.test\/webhooks\/ivr\/answer\?session=/);
    expect((await missed('+919800019999')).json()).toEqual({ callback: false, answerUrl: null });
  });
  it('answering plays Right Now in HER language then asks her to speak; XML on request', async () => {
    await user('+919800010003', 'hi');
    const url = (await missed('+919800010003')).json().answerUrl.replace('https://sakhi.test', '');
    const r = (await app.inject({ method: 'GET', url, headers: H })).json();
    expect(r.say[0].text).toBe(IVR.intro.hi); expect(r.say.at(-1).text).toBe(IVR.prompt.hi); expect(r.gather).toMatchObject({ input: 'speech', lang: 'hi' });
    const xml = await app.inject({ method: 'GET', url: url + '&format=twiml', headers: H });
    expect(xml.headers['content-type']).toContain('xml'); expect(xml.body).toContain('<Gather'); expect(xml.body).toContain('hi-IN');
  });
  it('a forged, tampered or expired session is refused', async () => {
    await user('+919800010004');
    const session = await sessionOf('+919800010004');
    expect((await speech('forged.mac', { transcript: 'hot flashes' })).statusCode).toBe(401);
    const [b, mac] = session.split('.');
    const swapped = Buffer.from(Buffer.from(b, 'base64url').toString().replace(/^[^.]+/, 'someone-else')).toString('base64url') + '.' + mac;
    expect((await speech(swapped, { transcript: 'hot flashes' })).statusCode).toBe(401);
    const saved = clock; clock = new Date(clock.getTime() + 16 * 60_000);
    const expired = await speech(session, { transcript: 'hot flashes' });
    clock = saved; expect(expired.statusCode).toBe(401);
  });
  it('what she says goes through the same safety pipeline: symptoms read back, NOTHING saved, nothing logged', async () => {
    await user('+919800010005', 'en');
    const session = await sessionOf('+919800010005');
    const logsBefore = (await db.query('SELECT 1 FROM logs')).length;
    const r = (await speech(session, { SpeechResult: 'hot flashes and very tired, private words about my sister' })).json();
    expect(said(r)).toContain('I heard: hot flashes, tiredness'); expect(said(r)).toContain('Nothing has been saved yet'); expect(r.hangup).toBe(true);
    expect((await db.query('SELECT 1 FROM logs')).length).toBe(logsBefore);
    expect(JSON.stringify(await db.query('SELECT * FROM audit_log'))).not.toMatch(/private words|sister/);
    expect(said(r)).not.toContain('private words');
  });
  it('a crisis phrase gets the scripted reply and the helplines read digit by digit, with no LLM', async () => {
    await user('+919800010006', 'en');
    const r = (await speech(await sessionOf('+919800010006'), { transcript: 'I want to die' })).json();
    expect(said(r)).toContain('you are not alone'); expect(said(r)).toContain('1 1 2'); expect(said(r)).toContain('1 4 4 1 6'); expect(r.hangup).toBe(true);
  });
  it('policy refusals and silence are handled kindly', async () => {
    await user('+919800010007', 'en');
    const session = await sessionOf('+919800010007');
    expect(said((await speech(session, { transcript: 'should I start HRT' })).json())).toMatch(/doctor/i);
    expect((await speech(session, {})).json().say[0].text).toBe(IVR.nothing.en);
  });
  it('limits repeated missed calls from one number', async () => {
    await user('+919800010008');
    const codes: number[] = []; for (let i = 0; i < 7; i++) codes.push((await missed('+919800010008')).statusCode);
    expect(codes[0]).toBe(200); expect(codes[6]).toBe(429);
  });
});

describe('in-app simulator (same handlers, her own session)', () => {
  it('needs sign-in, and plays the same script and the same safety handling', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/ivr/simulate/missed-call' })).statusCode).toBe(401);
    const h = await user('+919800010009', 'mr');
    const call = (await app.inject({ method: 'POST', url: '/api/ivr/simulate/missed-call', headers: h })).json();
    expect(call.say[0].text).toBe(IVR.intro.mr); expect(call.gather.lang).toBe('mr');
    const crisis = (await app.inject({ method: 'POST', url: '/api/ivr/simulate/speech', headers: h, payload: { transcript: 'मला जगावंसं वाटत नाही' } })).json();
    expect(crisis.hangup).toBe(true); expect(said(crisis)).toContain('1 1 2');
  });
});
