import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';
import { CALM_VOICE_SETTINGS, DEFAULT_VOICE_ID, ElevenLabsTts, ttsFromEnv, withPauses } from '../src/providers/tts.js';

const KEY = 'sk_test_SECRET_KEY_12345';

describe('ElevenLabs provider', () => {
  it('is off without a key, and on with one (default premade voice, overridable)', () => {
    expect(ttsFromEnv({})).toBeNull();
    expect(ttsFromEnv({ ELEVENLABS_API_KEY: KEY })?.name).toBe('elevenlabs');
  });

  it('sends the key as a header (never in the URL or body) and a calm, slow voice setting', async () => {
    let seen: { url: string; headers: Record<string, string>; body: any } | null = null;
    const f = (async (url: string, init: any) => { seen = { url, headers: init.headers, body: JSON.parse(init.body) }; return { ok: true, arrayBuffer: async () => new TextEncoder().encode('ID3audio').buffer }; }) as unknown as typeof fetch;
    const p = new ElevenLabsTts({ apiKey: KEY, voiceId: 'voiceX', model: 'eleven_multilingual_v2' }, f);
    const out = await p.synth('Breathe in. Hold softly.', 'en');
    expect(out.mime).toBe('audio/mpeg'); expect(out.audio.toString()).toBe('ID3audio');
    expect(seen!.url).toContain('/v1/text-to-speech/voiceX'); expect(seen!.url).not.toContain(KEY);
    expect(seen!.headers['xi-api-key']).toBe(KEY); expect(JSON.stringify(seen!.body)).not.toContain(KEY);
    expect(seen!.body.voice_settings).toEqual(CALM_VOICE_SETTINGS);
    expect(CALM_VOICE_SETTINGS.speed).toBeLessThan(1); expect(CALM_VOICE_SETTINGS.stability).toBeGreaterThanOrEqual(0.7); expect(CALM_VOICE_SETTINGS.style).toBe(0);
    expect(seen!.body.text).toContain('<break time="0.6s" />');
    expect(DEFAULT_VOICE_ID.length).toBeGreaterThan(10);
  });

  it('adds sentence pauses only where the model supports them (Latin and Indic full stops)', () => {
    expect(withPauses('One. Two।  Three', 'eleven_multilingual_v2')).toBe('One. <break time="0.6s" /> Two। <break time="0.6s" /> Three');
    expect(withPauses('One. Two.', 'eleven_v3')).toBe('One. Two.');
    expect(withPauses('Single sentence.', 'eleven_multilingual_v2')).toBe('Single sentence.');
  });

  it('errors without leaking the key or the provider body', async () => {
    const f = (async () => ({ ok: false, status: 401, text: async () => `bad key ${KEY}` })) as unknown as typeof fetch;
    const p = new ElevenLabsTts({ apiKey: KEY, voiceId: 'v', model: 'm' }, f);
    await expect(p.synth('hi', 'en')).rejects.toThrow(/401/);
    await expect(p.synth('hi', 'en')).rejects.not.toThrow(KEY);
  });
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 1).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let on: FastifyInstance; let off: FastifyInstance; let calls = 0; let fail = false;
beforeAll(async () => {
  db = await pgliteDb(); await migrate(db);
  const fake = { name: 'elevenlabs', synth: async () => { calls++; if (fail) throw new Error('boom'); return { audio: Buffer.from('MP3DATA'), mime: 'audio/mpeg' }; } };
  on = await buildApp({ db, llm: null, env, weather: noWeather, tts: fake });
  off = await buildApp({ db, llm: null, env, weather: noWeather, tts: null });
});
afterAll(async () => { await on.close(); await off.close(); await db.close(); });

async function login(app: FastifyInstance, phone: string) {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const tts = (app: FastifyInstance, s: { cookie: string; csrf: string }, payload: unknown) => app.inject({ method: 'POST', url: '/api/tts', payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });

describe('POST /api/tts', () => {
  it('without a key: 501, health says browser voice, and the app falls back', async () => {
    const s = await login(off, '+919700000001');
    expect((await tts(off, s, { text: 'Breathe in', lang: 'en' })).statusCode).toBe(501);
    expect((await off.inject({ method: 'GET', url: '/healthz' })).json().tts).toBe('browser');
  });
  it('with a key: returns audio, caches repeated phrases, and health says server', async () => {
    const s = await login(on, '+919700000002');
    calls = 0;
    const a = await tts(on, s, { text: 'Breathe in', lang: 'en' });
    expect(a.statusCode).toBe(200); expect(a.headers['content-type']).toBe('audio/mpeg'); expect(a.rawPayload.toString()).toBe('MP3DATA');
    await tts(on, s, { text: 'Breathe in', lang: 'en' });
    expect(calls).toBe(1); // cached: cues repeat every breath
    await tts(on, s, { text: 'Breathe in', lang: 'hi' }); expect(calls).toBe(2); // language is part of the cache key
    expect((await on.inject({ method: 'GET', url: '/healthz' })).json().tts).toBe('server');
  });
  it('never exposes a key anywhere in responses', async () => {
    const s = await login(on, '+919700000003');
    const blob = (await on.inject({ method: 'GET', url: '/healthz' })).body + (await tts(on, s, { text: 'ok', lang: 'en' })).headers['content-type'];
    expect(blob).not.toMatch(/sk_|api[_-]?key|xi-api/i);
  });
  it('needs a session, validates input, and refuses text the app itself would never say', async () => {
    const s = await login(on, '+919700000004');
    expect((await on.inject({ method: 'POST', url: '/api/tts', payload: { text: 'x', lang: 'en' } })).statusCode).toBe(401);
    expect((await tts(on, s, { text: '', lang: 'en' })).statusCode).toBe(400);
    expect((await tts(on, s, { text: 'a'.repeat(401), lang: 'en' })).statusCode).toBe(400);
    expect((await tts(on, s, { text: 'hi', lang: 'fr' })).statusCode).toBe(400);
    expect((await tts(on, s, { text: 'hi', lang: 'en', extra: 1 })).statusCode).toBe(400);
    expect((await tts(on, s, { text: 'Take 50 mg of estrogen', lang: 'en' })).statusCode).toBe(400);
  });
  it('a provider failure is a 502 (the app then uses the browser voice), without detail', async () => {
    const s = await login(on, '+919700000005');
    fail = true;
    const r = await tts(on, s, { text: 'never cached before', lang: 'en' });
    fail = false;
    expect(r.statusCode).toBe(502); expect(r.body).not.toMatch(/boom/);
  });
  it('is audited by provider only, never by text', async () => {
    const s = await login(on, '+919700000006');
    await tts(on, s, { text: 'a very private sentence', lang: 'en' });
    const rows = JSON.stringify(await db.query('SELECT * FROM audit_log'));
    expect(rows).toContain('elevenlabs'); expect(rows).not.toContain('very private sentence');
  });
});

describe('security headers allow what the voice and PWA need, and nothing wider', () => {
  it('permits blob: audio (server voice) and the service worker, but not remote scripts or frames', async () => {
    const csp = String((await on.inject({ method: 'GET', url: '/healthz' })).headers['content-security-policy']);
    expect(csp).toMatch(/media-src 'self' blob:/); expect(csp).toMatch(/worker-src 'self'/); expect(csp).toMatch(/manifest-src 'self'/);
    expect(csp).toMatch(/default-src 'self'/); expect(csp).toMatch(/frame-ancestors 'none'/); expect(csp).not.toMatch(/script-src[^;]*(\*|unsafe)/);
  });
});
