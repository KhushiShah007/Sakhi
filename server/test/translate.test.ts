import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { LANGS } from '../src/config.js';
import { CARD_TYPES } from '../src/content/family.js';
import { SENTENCES, TONES, suggestCard } from '../src/content/translate.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import type { LlmProvider } from '../src/llm/provider.js';
import { violatesOutputPolicy } from '../src/safety/validate.js';
import { noWeather } from '../src/providers/weather.js';

describe('sentence library', () => {
  it('has every card x tone x language, short, calm and passes the output policy', () => {
    for (const c of CARD_TYPES) for (const t of TONES) for (const l of LANGS) {
      const s = SENTENCES[c][t][l];
      expect(s.length, `${c}/${t}/${l}`).toBeGreaterThan(10);
      expect(s.length).toBeLessThan(160);
      expect(violatesOutputPolicy(s), `${c}/${t}/${l}: ${s}`).toBe(false);
      expect(/[!]{2,}|\d/.test(s)).toBe(false);
    }
  });
  it('is written in the right script', () => {
    for (const c of CARD_TYPES) for (const t of TONES) {
      expect(/[ऀ-ॿ]/.test(SENTENCES[c][t].hi)).toBe(true);
      expect(/[ऀ-ॿ]/.test(SENTENCES[c][t].mr)).toBe(true);
      expect(/[઀-૿]/.test(SENTENCES[c][t].gu)).toBe(true);
      expect(/^[\x00-\x7F]+$/.test(SENTENCES[c][t].en)).toBe(true);
    }
  });
});

describe('suggestCard', () => {
  it.each([
    [['night_waking', 'night_sweats'], 'rough_night'], [['irritability', 'anxiety'], 'need_space'], [['brain_fog'], 'overwhelmed'],
    [['fatigue', 'joint_pain'], 'take_over_dinner'], [['low_mood'], 'just_sit_with_me'], [[], 'need_space'],
  ] as const)('%j -> %s', (symptoms, card) => expect(suggestCard([...symptoms])).toBe(card));
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 4).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let llm: LlmProvider | null = null;
const proxy: LlmProvider = { name: 'proxy', complete: (r) => (llm ? llm.complete(r) : Promise.reject(new Error('none'))) };
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: proxy, env, weather: noWeather }); });
afterAll(async () => { await app.close(); await db.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const call = (s: S, method: 'GET' | 'POST', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });

describe('POST /api/translate', () => {
  it('returns three tones from the library plus the suggested card, with no LLM', async () => {
    llm = null;
    const s = await login('+919400000001');
    const r = (await call(s, 'POST', '/api/translate', { symptoms: ['night_waking', 'poor_sleep'], lang: 'en' })).json();
    expect(r).toMatchObject({ kind: 'ok', card: 'rough_night', source: 'library' });
    expect(r.tones.gentle).toBe(SENTENCES.rough_night.gentle.en);
    expect(Object.keys(r.tones).sort()).toEqual(['direct', 'gentle', 'light']);
  });
  it('she can pick the card herself', async () => {
    llm = null;
    const s = await login('+919400000002');
    expect((await call(s, 'POST', '/api/translate', { symptoms: [], card: 'take_over_dinner', lang: 'hi' })).json().tones.direct).toBe(SENTENCES.take_over_dinner.direct.hi);
  });
  it('red flags win: a crisis phrase gets the scripted reply, not a sentence', async () => {
    llm = { name: 'trip', complete: async () => { throw new Error('LLM must not be called'); } };
    const s = await login('+919400000003');
    const r = (await call(s, 'POST', '/api/translate', { text: 'I want to die', symptoms: [], lang: 'en' })).json();
    expect(r.kind).toBe('crisis'); expect(r.llmUsed).toBe(false);
  });
  it('uses a valid LLM rewrite', async () => {
    llm = { name: 'ok', complete: async () => JSON.stringify({ gentle: 'I am worn out and need a quiet evening.', direct: 'I need a quiet evening, please.', light: 'Quiet evening mode: on.' }) };
    const s = await login('+919400000004');
    const r = (await call(s, 'POST', '/api/translate', { text: 'so tired', symptoms: ['fatigue'], lang: 'en' })).json();
    expect(r.source).toBe('llm'); expect(r.tones.light).toBe('Quiet evening mode: on.');
  });
  it.each([
    ['not json', 'nope'],
    ['missing a tone', JSON.stringify({ gentle: 'I am tired but okay.', direct: 'I am tired, please help.' })],
    ['extra keys', JSON.stringify({ gentle: 'I am tired but okay.', direct: 'I am tired, please help.', light: 'Tired, but fine.', note: 'x' })],
    ['a dose', JSON.stringify({ gentle: 'Take 50 mg of estrogen for me.', direct: 'I need rest now.', light: 'Resting now.' })],
    ['a diagnosis', JSON.stringify({ gentle: 'I am tired.', direct: 'You have thyroid disease, fix it.', light: 'Resting now.' })],
  ])('falls back to the library when the LLM returns %s', async (_n, out) => {
    llm = { name: 'bad', complete: async () => out };
    const s = await login('+919400000010');
    const r = (await call(s, 'POST', '/api/translate', { text: 'so tired', symptoms: ['fatigue'], lang: 'en' })).json();
    expect(r.source).toBe('library'); expect(r.tones.gentle).toBe(SENTENCES.take_over_dinner.gentle.en);
  });
  it('audits metadata only, never her words', async () => {
    llm = null;
    const s = await login('+919400000020');
    await call(s, 'POST', '/api/translate', { text: 'my secret feelings about my mother in law', symptoms: ['anxiety'], lang: 'en' });
    expect(JSON.stringify(await db.query('SELECT * FROM audit_log'))).not.toContain('mother in law');
  });
  it('validates input and needs a session', async () => {
    llm = null;
    const s = await login('+919400000030');
    expect((await call(s, 'POST', '/api/translate', { symptoms: ['cancer'] })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/translate', { card: 'free text', symptoms: [] })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/translate', payload: {} })).statusCode).toBe(401);
  });
});

describe('GET /api/cards', () => {
  it('lists the five enumerated cards with text in every language', async () => {
    const s = await login('+919400000040');
    const r = (await call(s, 'GET', '/api/cards')).json();
    expect(r.cards.map((c: { type: string }) => c.type)).toEqual([...CARD_TYPES]);
    for (const c of r.cards) for (const l of LANGS) expect(c.text[l].length).toBeGreaterThan(10);
  });
});
