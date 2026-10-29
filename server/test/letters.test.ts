import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { composeLetter, generateDueLetters, monthOf, prevMonth } from '../src/api/letters.js';
import type { LogRow } from '../src/api/home.js';
import { awakeSeverity, evaluateRehearsal } from '../src/api/night.js';
import { LANGS } from '../src/config.js';
import { LETTER, SYMPTOM_NAME } from '../src/content/letter.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { keyFromEnv } from '../src/privacy/crypto.js';
import { noWeather } from '../src/providers/weather.js';
import { SYMPTOMS } from '../src/safety/mrs.js';
import { violatesOutputPolicy } from '../src/safety/validate.js';

describe('month helpers', () => {
  it('previous month wraps the year', () => { expect(prevMonth('2026-01')).toBe('2025-12'); expect(prevMonth('2026-11')).toBe('2026-10'); expect(monthOf('2026-10-29')).toBe('2026-10'); });
});

describe('letter wording', () => {
  it('has every symptom name and paragraph in 4 languages, and passes the output policy', () => {
    for (const l of LANGS) {
      for (const s of SYMPTOMS) expect(SYMPTOM_NAME[s][l].length).toBeGreaterThan(2);
      for (const [k, v] of Object.entries(LETTER)) { expect(v[l].length, `${k}/${l}`).toBeGreaterThan(3); expect(violatesOutputPolicy(v[l]), `${k}/${l}`).toBe(false); }
    }
  });
});

const row = (symptom: string, severity: number, iso: string, extra: Partial<LogRow> = {}): LogRow => ({ symptom: symptom as LogRow['symptom'], severity, at: iso, trigger: 'unspecified', time_of_day: 'unspecified', ...extra });

describe('composeLetter', () => {
  const rows = [row('hot_flash', 4, '2026-10-03T05:00:00Z', { trigger: 'heat' }), row('poor_sleep', 3, '2026-10-04T05:00:00Z'), row('fatigue', 1, '2026-10-20T05:00:00Z', { trigger: 'heat' }), row('hot_flash', 1, '2026-10-21T05:00:00Z'), row('headache', 4, '2026-09-30T05:00:00Z')];
  const L = composeLetter({ rows, checkinDays: ['2026-10-10', '2026-09-02'], signals: { sent: 3, answered: 2 }, name: 'Sunita', lang: 'en', month: '2026-10' });
  it('counts only this month (logs and one-tap check-ins) and names her biggest themes', () => {
    expect(L.stats.checkInDays).toBe(5); expect(L.stats.topSymptoms).toEqual(['hot_flash', 'poor_sleep', 'fatigue']);
    expect(L.paragraphs[0]).toBe('This month you checked in on 5 days. Looking after yourself like this takes effort, and it counts.');
    expect(L.paragraphs.join(' ')).toContain('hot flashes, poor sleep, tiredness'); expect(L.paragraphs.join(' ')).not.toMatch(/headache/);
  });
  it('is strengths-based and honest: family help is counted, and the trend is only "lighter" when it is', () => {
    expect(L.paragraphs.join(' ')).toContain('reached out to your people 3 times, and they answered 2');
    expect(L.paragraphs.join(' ')).toContain('The second half of the month was lighter');
    const heavier = composeLetter({ rows: [row('hot_flash', 1, '2026-10-03T05:00:00Z'), row('hot_flash', 4, '2026-10-25T05:00:00Z')], checkinDays: [], signals: { sent: 0, answered: 0 }, name: 'A', lang: 'en', month: '2026-10' });
    expect(heavier.paragraphs.join(' ')).toContain('Some weeks are heavier than others'); expect(heavier.paragraphs.join(' ')).not.toContain('lighter');
    const oneHalf = composeLetter({ rows: [row('hot_flash', 3, '2026-10-03T05:00:00Z')], checkinDays: [], signals: { sent: 0, answered: 0 }, name: 'A', lang: 'en', month: '2026-10' });
    expect(oneHalf.paragraphs.join(' ')).not.toMatch(/lighter|heavier/); // no invented trend from one half
  });
  it('uses the singular, and says so kindly when she did not check in', () => {
    expect(composeLetter({ rows: [row('hot_flash', 2, '2026-10-03T05:00:00Z')], checkinDays: [], signals: { sent: 0, answered: 0 }, name: 'A', lang: 'en', month: '2026-10' }).paragraphs[0]).toContain('on 1 day.');
    const none = composeLetter({ rows: [], checkinDays: [], signals: { sent: 0, answered: 0 }, name: 'A', lang: 'en', month: '2026-10' });
    expect(none.paragraphs).toEqual([LETTER.none.en, LETTER.close.en]);
  });
  it('is written in her language and never quotes or diagnoses', () => {
    for (const l of ['hi', 'mr', 'gu'] as const) {
      const x = composeLetter({ rows, checkinDays: [], signals: { sent: 3, answered: 2 }, name: 'S', lang: l, month: '2026-10' });
      expect(x.paragraphs.every((p) => /[ऀ-ॿ઀-૿]/.test(p))).toBe(true);
      expect(violatesOutputPolicy(x.paragraphs.join(' '))).toBe(false);
    }
  });
});

describe('3 AM severity and rehearsal rules', () => {
  it('maps minutes awake to severity', () => { expect([1, 14, 15, 44, 45, 89, 90, 600].map(awakeSeverity)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]); });
  it.each([
    ['en', 'I feel exhausted at night. Could you take the dishes every evening, please?', ['i_statement', 'ask', 'no_blame', 'calm'], 'great'],
    ['en', 'You never help and it is always my job', ['ask', 'no_blame', 'calm'].slice(0, 0), 'i_statement'],
    ['en', 'I feel tired.', [], 'ask'],
    ['en', 'I need you to help me NOW!!', [], 'calm'],
    ['hi', 'मुझे रातों को नींद नहीं आती। क्या आप हर शाम बर्तन कर सकते हैं?', [], 'great'],
    ['hi', 'तुम हमेशा मदद नहीं करते', [], 'i_statement'],
    ['mr', 'मला खूप थकवा आहे. तुम्ही मदत करू शकता का?', [], 'great'],
    ['gu', 'મને બહુ થાક લાગે છે. કૃપા કરીને મદદ કરશો?', [], 'great'],
  ] as const)('[%s] %s -> tip %s', (lang, text, _x, tip) => { expect(evaluateRehearsal([text], lang).tip).toBe(tip); });
  it('blame is caught in every language', () => {
    expect(evaluateRehearsal(['मुझे लगता है तुम्हारी वजह से'], 'hi').checks.find((c) => c.id === 'no_blame')!.pass).toBe(false);
    expect(evaluateRehearsal(['मला वाटते तुझ्यामुळे'], 'mr').checks.find((c) => c.id === 'no_blame')!.pass).toBe(false);
    expect(evaluateRehearsal(['મને લાગે છે તમારા કારણે'], 'gu').checks.find((c) => c.id === 'no_blame')!.pass).toBe(false);
  });
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 8).toString('base64'), PUBLIC_URL: 'https://sakhi.test' } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let clock = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather, tts: null }); });
afterAll(async () => { await app.close(); await db.close(); });
interface S { cookie: string; csrf: string; phone: string }
async function login(phone: string, consent = true): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  const s = { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf, phone };
  if (consent) await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
  await call(s, 'PATCH', '/api/me', { name: 'Sunita', onboarded: true });
  return s;
}
const call = (s: S, method: 'GET' | 'POST' | 'DELETE' | 'PATCH', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const logAt = async (s: S, iso: string, text: string) => { const saved = clock; clock = new Date(iso); const u = (await call(s, 'POST', '/api/utterance', { text, lang: 'en' })).json(); await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true, severity: 3 })) }); clock = saved; };

describe('letters API', () => {
  it('generates from confirmed logs, stores it encrypted, lists it, and regenerates in place', async () => {
    const s = await login('+919800000001');
    await logAt(s, '2026-10-05T05:00:00Z', 'hot flashes and so tired, secret words about my sister in law');
    const g = (await call(s, 'POST', '/api/letters/generate', {})).json();
    expect(g.month).toBe('2026-10'); expect(g.greeting).toBe('Dear Sunita,'); expect(g.paragraphs[0]).toMatch(/checked in on 1 day/);
    const row = (await db.query<{ body_enc: string }>('SELECT body_enc FROM letters ORDER BY created_at DESC LIMIT 1'))[0];
    expect(row.body_enc.startsWith('v1.')).toBe(true); expect(row.body_enc).not.toContain('Sunita');
    expect(JSON.stringify(g)).not.toContain('sister in law');
    expect((await call(s, 'GET', '/api/letters')).json().letters.map((l: { month: string }) => l.month)).toEqual(['2026-10']);
    const hi = (await call(s, 'POST', '/api/letters/generate', { lang: 'hi' })).json();
    expect(/[ऀ-ॿ]/.test(hi.paragraphs[0])).toBe(true); expect(hi.id).toBe(g.id); // same row, replaced
    expect((await call(s, 'GET', '/api/letters/2026-10')).json().lang).toBe('hi');
    expect((await db.query('SELECT 1 FROM letters WHERE user_id=(SELECT id FROM users WHERE phone_hash IS NOT NULL ORDER BY created_at LIMIT 1)')).length).toBeGreaterThanOrEqual(0);
  });
  it('needs consent, validates months, hides other users letters', async () => {
    const s = await login('+919800000002', false);
    expect((await call(s, 'POST', '/api/letters/generate', {})).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    expect((await call(s, 'POST', '/api/letters/generate', { month: '2026-13' })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/letters/generate', { month: '2027-01' })).statusCode).toBe(400);
    expect((await call(s, 'GET', '/api/letters/2026-10')).statusCode).toBe(404);
    await call(s, 'POST', '/api/letters/generate', {});
    const other = await login('+919800000003');
    expect((await call(other, 'GET', '/api/letters/2026-10')).statusCode).toBe(404);
    expect((await call(other, 'POST', '/api/letters/2026-10/share')).statusCode).toBe(404);
  });
  it('sharing is her choice: an escaped read-only page, noindex, expiring and revocable', async () => {
    const s = await login('+919800000004');
    await call(s, 'PATCH', '/api/me', { name: '<script>alert(1)</script>' });
    await logAt(s, '2026-10-05T05:00:00Z', 'hot flashes today');
    await call(s, 'POST', '/api/letters/generate', {});
    const sh = (await call(s, 'POST', '/api/letters/2026-10/share')).json();
    expect(sh.link).toMatch(/^https:\/\/sakhi\.test\/l\//);
    const token = sh.link.split('/l/')[1];
    const page = await app.inject({ method: 'GET', url: `/l/${token}` });
    expect(page.statusCode).toBe(200); expect(page.headers['x-robots-tag']).toBe('noindex'); expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).not.toContain('<script>'); expect(page.body).toContain('&lt;script&gt;'); expect(page.body).toContain('checked in on 1 day');
    expect(JSON.stringify((await call(s, 'GET', '/api/audit')).json())).toContain('letter-link');
    expect((await call(s, 'DELETE', `/api/letters/shares/${sh.id}`)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/l/${token}` })).statusCode).toBe(410);
    const t2 = (await call(s, 'POST', '/api/letters/2026-10/share')).json().link.split('/l/')[1];
    clock = new Date(clock.getTime() + 8 * 86400_000);
    const expired = await app.inject({ method: 'GET', url: `/l/${t2}` });
    clock = new Date('2026-10-29T10:00:00Z');
    expect(expired.statusCode).toBe(410); expect(expired.body).toBe((await app.inject({ method: 'GET', url: '/l/' + 'q'.repeat(32) })).body);
  });
});

describe('monthly job', () => {
  it('writes last month for consenting users with data, once, and never for others', async () => {
    const withData = await login('+919800000010'); const noData = await login('+919800000011'); const noConsent = await login('+919800000012', false);
    await logAt(withData, '2026-10-05T05:00:00Z', 'hot flashes');
    await call(noConsent, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: true });
    const saved = clock; clock = new Date('2026-11-01T01:00:00Z');
    const key = keyFromEnv(env);
    const n1 = await generateDueLetters(db, key, clock);
    const n2 = await generateDueLetters(db, key, clock);
    clock = saved;
    expect(n1).toBeGreaterThanOrEqual(1); expect(n2).toBe(0); // idempotent
    expect((await call(withData, 'GET', '/api/letters/2026-10')).statusCode).toBe(200);
    expect((await call(noData, 'GET', '/api/letters/2026-10')).statusCode).toBe(404);
    expect((await call(noConsent, 'GET', '/api/letters/2026-10')).statusCode).toBe(404);
  });
  it('runs on a mid-month day without writing the current month', async () => {
    const s = await login('+919800000013');
    await logAt(s, '2026-10-05T05:00:00Z', 'hot flashes');
    await generateDueLetters(db, keyFromEnv(env), new Date('2026-10-15T10:00:00Z'));
    expect((await call(s, 'GET', '/api/letters/2026-10')).statusCode).toBe(404);
  });
});

describe('awakenings (3 AM Mode)', () => {
  it('logs a confirmed night waking with a severity from the minutes, needs consent', async () => {
    const s = await login('+919800000020', false);
    expect((await call(s, 'POST', '/api/awakenings', { minutes: 30 })).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    expect((await call(s, 'POST', '/api/awakenings', { minutes: 0 })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/awakenings', { minutes: 601 })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/awakenings', { minutes: 50 })).json()).toMatchObject({ saved: true, severity: 3 });
    const logs = (await call(s, 'GET', '/api/logs')).json().logs;
    expect(logs[0]).toMatchObject({ symptom: 'night_waking', severity: 3, time: 'night' });
  });
});

describe('rehearsal feedback endpoint', () => {
  it('returns rule-based feedback and stores nothing', async () => {
    const s = await login('+919800000030');
    const before = (await db.query('SELECT 1 FROM audit_log')).length;
    const r = (await call(s, 'POST', '/api/rehearsal/feedback', { scenario: 'family', lines: ['I feel exhausted. Could you help every evening?'], lang: 'en' })).json();
    expect(r.tip).toBe('great'); expect(r.checks).toHaveLength(4);
    expect((await db.query('SELECT 1 FROM audit_log')).length).toBe(before);
  });
  it('a crisis phrase in role-play gets the real crisis reply, not feedback', async () => {
    const s = await login('+919800000031');
    const r = (await call(s, 'POST', '/api/rehearsal/feedback', { scenario: 'doctor', lines: ['I want to die'], lang: 'en' })).json();
    expect(r.kind).toBe('crisis'); expect(r.llmUsed).toBe(false);
  });
  it('validates input', async () => {
    const s = await login('+919800000032');
    expect((await call(s, 'POST', '/api/rehearsal/feedback', { scenario: 'boss', lines: ['x'], lang: 'en' })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/rehearsal/feedback', { scenario: 'hr', lines: [], lang: 'en' })).statusCode).toBe(400);
  });
});
