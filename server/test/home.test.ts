import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { istDay } from '../src/api/home.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { OpenMeteoProvider, noWeather, type WeatherProvider } from '../src/providers/weather.js';
import { moodForDay } from '../src/safety/mood.js';

describe('moodForDay', () => {
  it('no logs = no blob (not "calm")', () => expect(moodForDay([])).toEqual({ mood: null, load: 0 }));
  it('light day is calm', () => expect(moodForDay([{ symptom: 'headache', severity: 2 }]).mood).toBe('calm'));
  it('heaviest group wins', () => {
    expect(moodForDay([{ symptom: 'hot_flash', severity: 3 }, { symptom: 'fatigue', severity: 2 }]).mood).toBe('hot');
    expect(moodForDay([{ symptom: 'fatigue', severity: 3 }, { symptom: 'poor_sleep', severity: 3 }, { symptom: 'hot_flash', severity: 2 }]).mood).toBe('tired');
    expect(moodForDay([{ symptom: 'low_mood', severity: 4 }]).mood).toBe('low');
  });
  it('ties resolve by a fixed order, so the result is stable', () => {
    expect(moodForDay([{ symptom: 'hot_flash', severity: 2 }, { symptom: 'fatigue', severity: 2 }]).mood).toBe('hot');
  });
});

describe('India calendar day', () => {
  it('rolls over at midnight IST, not UTC', () => {
    expect(istDay(new Date('2026-10-29T18:29:00Z'))).toBe('2026-10-29');
    expect(istDay(new Date('2026-10-29T18:31:00Z'))).toBe('2026-10-30');
  });
});

describe('Open-Meteo provider', () => {
  const hours = (v: number) => Array.from({ length: 48 }, (_, i) => (i >= 24 ? v + (i === 38 ? 10 : 0) : 0));
  const fake = (calls: string[]) => (async (url: string) => {
    calls.push(url);
    const body = url.includes('geocoding') ? { results: [{ latitude: 18.5, longitude: 73.8 }] }
      : url.includes('air-quality') ? { hourly: { us_aqi: hours(100) } }
        : { daily: { temperature_2m_max: [30, 36.4] }, hourly: { relative_humidity_2m: hours(60) } };
    return { ok: true, json: async () => body };
  }) as unknown as typeof fetch;

  it('returns tomorrow temp, afternoon humidity and the worst AQI, and caches by city', async () => {
    const calls: string[] = [];
    const p = new OpenMeteoProvider(fake(calls));
    expect(await p.tomorrow('Pune')).toEqual({ tempC: 36, humidityPct: 70, aqi: 110, source: 'open-meteo' });
    await p.tomorrow('pune');
    expect(calls.length).toBe(3); // geocode + forecast + air quality, once
  });
  it('never throws: unknown city, network failure and bad payloads all give null', async () => {
    expect(await new OpenMeteoProvider((async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch).tomorrow('Nowhere')).toBeNull();
    expect(await new OpenMeteoProvider((async () => { throw new Error('offline'); }) as unknown as typeof fetch).tomorrow('Pune')).toBeNull();
    expect(await new OpenMeteoProvider((async () => ({ ok: false })) as unknown as typeof fetch).tomorrow('Pune')).toBeNull();
    expect(await noWeather.tomorrow('Pune')).toBeNull();
  });
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 8).toString('base64') } as NodeJS.ProcessEnv;
const hot: WeatherProvider = { name: 'fake', tomorrow: async () => ({ tempC: 39, humidityPct: 80, aqi: 160, source: 'fake' }) };
let db: Db; let app: FastifyInstance;
let clock = new Date('2026-10-29T10:00:00Z'); // Thursday in India

beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: hot }); });
afterAll(async () => { await app.close(); await db.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978 } });
  const s = { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
  await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
  await call(s, 'POST', '/api/consents', { purpose: 'family_signals', granted: true });
  return s;
}
const call = (s: S, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const logAt = async (s: S, when: string, text: string, severity = 3) => {
  const saved = clock; clock = new Date(when);
  const u = (await call(s, 'POST', '/api/utterance', { text, lang: 'en' })).json();
  await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true, severity })) });
  clock = saved;
};

describe('GET /api/home', () => {
  it('a brand-new user gets an empty but valid home', async () => {
    const s = await login('+919300000001');
    const h = (await call(s, 'GET', '/api/home')).json();
    expect(h.week).toHaveLength(7); expect(h.month).toHaveLength(30);
    expect(h.daysCheckedLast7).toBe(0); expect(h.loggedToday).toBe(false);
    expect(h.week.every((d: { mood: unknown }) => d.mood === null)).toBe(true);
    expect(h.milestones).toEqual({ firstWeek: false, firstSignal: false, firstBrief: false });
    expect(h.weather.estimate).toBe(true);
  });

  it('week is Sunday-first, marks today and tomorrow, and shows moods only for days she logged', async () => {
    const s = await login('+919300000002');
    await call(s, 'PATCH', '/api/me', { city: 'Pune' });
    await logAt(s, '2026-10-27T05:00:00Z', 'hot flashes all day');   // Tue
    await logAt(s, '2026-10-29T04:00:00Z', 'so tired and no energy'); // Thu (today)
    const h = (await call(s, 'GET', '/api/home')).json();
    expect(h.today).toBe('2026-10-29'); expect(h.weekday).toBe(4);
    expect(h.week.map((d: { day: number }) => d.day)).toEqual([25, 26, 27, 28, 29, 30, 31]);
    expect(h.week.map((d: { kind: string }) => d.kind)).toEqual(['past', 'past', 'past', 'past', 'today', 'forecast', 'future']);
    expect(h.week[2].mood).toBe('hot'); expect(h.week[4].mood).toBe('tired'); expect(h.week[3].mood).toBeNull();
    expect(h.loggedToday).toBe(true); expect(h.daysCheckedLast7).toBe(2);
    expect(h.todayTop[0].symptom).toBe('fatigue');
  });

  it('the weather card uses her logs plus tomorrow\'s real forecast, and says it is an estimate', async () => {
    const s = await login('+919300000003');
    await call(s, 'PATCH', '/api/me', { city: 'Pune' });
    await logAt(s, '2026-10-28T20:00:00Z', 'hot flashes and cannot sleep, so much stress');
    const w = (await call(s, 'GET', '/api/home')).json().weather;
    expect(w.tomorrow).toMatchObject({ tempC: 39, humidityPct: 80, aqi: 160 });
    expect(w.score).toBe(w.factors.reduce((a: number, f: { points: number }) => a + f.points, 0));
    expect(w.factors.map((f: { label: string }) => f.label).join()).toMatch(/Warm weather.*High humidity.*Poor air/s);
    expect(w.level).not.toBe('low'); expect(w.estimate).toBe(true);
  });

  it('without a city, weather is null and the score runs on her logs only', async () => {
    const s = await login('+919300000004');
    const w = (await call(s, 'GET', '/api/home')).json().weather;
    expect(w.tomorrow).toBeNull(); expect(w.level).toBe('low');
  });

  it('sharing tomorrow\'s alert flips `shared`, and only the level is stored', async () => {
    const s = await login('+919300000005');
    await call(s, 'PATCH', '/api/me', { city: 'Pune' });
    expect((await call(s, 'GET', '/api/home')).json().weather.shared).toBe(false);
    expect((await call(s, 'POST', '/api/symptom-weather', { share: true })).json().shared).toBe(true);
    expect((await call(s, 'GET', '/api/home')).json().weather.shared).toBe(true);
    const row = (await db.query<Record<string, unknown>>('SELECT * FROM household_alerts'))[0];
    expect(Object.keys(row).sort()).toEqual(['for_date', 'level', 'user_id']);
  });

  it('milestones follow real events', async () => {
    const s = await login('+919300000006');
    await call(s, 'POST', '/api/people', { name: 'R', herLabel: 'S', role: 'husband', lang: 'en' });
    await call(s, 'POST', '/api/signals', { cardType: 'need_space' });
    await call(s, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: true });
    await call(s, 'GET', '/api/brief');
    for (let d = 20; d <= 28; d++) await logAt(s, `2026-10-${d}T05:00:00Z`, 'hot flashes');
    const m = (await call(s, 'GET', '/api/home')).json().milestones;
    expect(m).toEqual({ firstWeek: true, firstSignal: true, firstBrief: true });
  });

  it('requires a session', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/home' })).statusCode).toBe(401);
  });
});

describe('one-tap mood check-ins', () => {
  it('stores one mood per day, counts as a check-in, fills the week strip, and needs consent', async () => {
    const s = await login('+919300000020');
    expect((await call(s, 'POST', '/api/checkins', { mood: 'purple' })).statusCode).toBe(400);
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: false });
    expect((await call(s, 'POST', '/api/checkins', { mood: 'calm' })).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
    expect((await call(s, 'POST', '/api/checkins', { mood: 'calm' })).statusCode).toBe(200);
    expect((await call(s, 'POST', '/api/checkins', { mood: 'tired' })).statusCode).toBe(200); // same day: replaces
    const h = (await call(s, 'GET', '/api/home')).json();
    expect(h.daysCheckedLast7).toBe(1); expect(h.loggedToday).toBe(true);
    expect(h.week.find((d: { kind: string }) => d.kind === 'today').mood).toBe('tired');
    expect((await db.query('SELECT 1 FROM checkins')).length).toBeGreaterThanOrEqual(1);
  });
  it('what she said outranks a mood tap on the same day', async () => {
    const s = await login('+919300000021');
    await call(s, 'POST', '/api/checkins', { mood: 'calm' });
    await logAt(s, '2026-10-29T04:00:00Z', 'hot flashes and so hot');
    expect((await call(s, 'GET', '/api/home')).json().week.find((d: { kind: string }) => d.kind === 'today').mood).toBe('hot');
  });
});
