import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { buildAtlasCsv, buildPilot, catalogue, syncContent } from '../src/api/admin.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const KEY = 'admin-key-for-tests-123';
const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', ADMIN_KEY: KEY, SAKHI_DATA_KEY: Buffer.alloc(32, 5).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let off: FastifyInstance; const now = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); await syncContent(db); app = await buildApp({ db, llm: null, env, now: () => now, weather: noWeather, tts: null }); off = await buildApp({ db, llm: null, env: { ...env, ADMIN_KEY: '' }, now: () => now, weather: noWeather, tts: null }); });
afterAll(async () => { await app.close(); await off.close(); await db.close(); });

const login = async () => String((await app.inject({ method: 'POST', url: '/api/admin/login', payload: { key: KEY } })).headers['set-cookie']).split(';')[0];

describe('content register', () => {
  it('registers the whole catalogue as version 1 and NONE of it as clinician reviewed', async () => {
    expect(catalogue().length).toBeGreaterThanOrEqual(20);
    const cookie = await login();
    const r = (await app.inject({ method: 'GET', url: '/api/admin/content', headers: { cookie } })).json();
    expect(r.total).toBe(catalogue().length); expect(r.pending).toBe(r.total);
    expect(r.items.every((i: any) => i.review.state === 'pending clinician review' && i.liveVersion === 1)).toBe(true);
    for (const kind of ['right_now', 'signal_card', 'say_this', 'module', 'crisis_script', 'rule_out']) expect(r.items.some((i: any) => i.kind === kind), kind).toBe(true);
    expect(r.note).toMatch(/NOT served/);
  });
  it('syncing twice does not duplicate', async () => { expect(await syncContent(db)).toBe(0); });
  it('a review needs a named reviewer and a real date; the date cannot be in the future', async () => {
    const cookie = await login();
    const post = (payload: object) => app.inject({ method: 'POST', url: '/api/admin/content/review', payload, headers: { cookie } });
    expect((await post({ kind: 'signal_card', key: 'need_space', version: 1, reviewer: 'x', reviewedAt: '2026-10-01' })).statusCode).toBe(400);
    expect((await post({ kind: 'signal_card', key: 'need_space', version: 1, reviewer: 'Dr A. Rao', reviewedAt: '2027-01-01' })).statusCode).toBe(400);
    expect((await post({ kind: 'signal_card', key: 'need_space', version: 1, reviewer: 'Dr A. Rao' })).statusCode).toBe(400);
    expect((await post({ kind: 'signal_card', key: 'nope', version: 1, reviewer: 'Dr A. Rao', reviewedAt: '2026-10-01' })).statusCode).toBe(404);
    expect((await post({ kind: 'signal_card', key: 'need_space', version: 1, reviewer: 'Dr A. Rao', reviewedAt: '2026-10-01' })).statusCode).toBe(200);
    const items = (await app.inject({ method: 'GET', url: '/api/admin/content', headers: { cookie } })).json().items;
    expect(items.find((i: any) => i.key === 'need_space').review).toEqual({ state: 'reviewed', reviewer: 'Dr A. Rao', reviewedAt: '2026-10-01' });
    expect(items.find((i: any) => i.key === 'overwhelmed').review.state).toBe('pending clinician review'); // others stay pending
  });
  it('the database itself refuses a "reviewed" flag without a reviewer and a date', async () => {
    await expect(db.query("UPDATE content_items SET clinician_reviewed=TRUE WHERE key='overwhelmed'")).rejects.toThrow();
  });
  it('a new version is a draft and starts UNREVIEWED even if the previous one was reviewed; the reviewed live version is kept', async () => {
    const cookie = await login();
    const r = await app.inject({ method: 'POST', url: '/api/admin/content/version', payload: { kind: 'signal_card', key: 'need_space', body: { en: 'new wording' } }, headers: { cookie } });
    expect(r.json()).toEqual({ version: 2, status: 'draft' });
    const item = (await app.inject({ method: 'GET', url: '/api/admin/content', headers: { cookie } })).json().items.find((i: any) => i.key === 'need_space');
    expect(item.liveVersion).toBe(1); expect(item.review.state).toBe('reviewed'); expect(item.versions[1]).toMatchObject({ version: 2, status: 'draft', clinicianReviewed: false });
  });
});

describe('admin access', () => {
  it('is disabled without ADMIN_KEY, refuses a wrong key, rate limits, and protects every endpoint', async () => {
    expect((await off.inject({ method: 'POST', url: '/api/admin/login', payload: { key: KEY } })).statusCode).toBe(503);
    expect((await app.inject({ method: 'POST', url: '/api/admin/login', payload: { key: 'wrong-key-123456' } })).statusCode).toBe(401);
    for (const u of ['/api/admin/content', '/api/admin/analytics', '/api/admin/atlas.csv']) expect((await app.inject({ method: 'GET', url: u })).statusCode, u).toBe(401);
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) codes.push((await app.inject({ method: 'POST', url: '/api/admin/login', payload: { key: `wrong-key-${i}-xxxx` }, remoteAddress: '10.8.8.8' })).statusCode);
    expect(codes[7]).toBe(429);
  });
  it('an HR session or a user session is not admin', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919700000001' } });
    const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919700000001', code: '123456', birthYear: 1978 } });
    expect((await app.inject({ method: 'GET', url: '/api/admin/content', headers: { cookie: String(v.headers['set-cookie']).split(';')[0] } })).statusCode).toBe(401);
  });
});

async function cohort(n: number, o: { research?: boolean; stage?: string; birth?: number; createdDaysAgo?: number; logs?: { early: string[]; late: string[] }; consultAfter?: number } = {}) {
  for (let i = 0; i < n; i++) {
    const id = randomUUID(); const created = new Date(now.getTime() - (o.createdDaysAgo ?? 45) * 86400_000);
    await db.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, stage, onboarded, created_at, first_consult_at) VALUES ($1,$2,'e',$3,'en',$4,TRUE,$5,$6)", [id, sha(id), o.birth ?? 1975, o.stage ?? 'perimenopause', created.toISOString(), o.consultAfter != null ? new Date(created.getTime() + o.consultAfter * 86400_000).toISOString().slice(0, 10) : null]);
    if (o.research !== false) await db.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'research_atlas',TRUE)", [id]);
    for (const sym of o.logs?.early ?? []) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,$3,3,$4)', [randomUUID(), id, sym, new Date(created.getTime() + 22 * 86400_000).toISOString()]);
    for (const sym of o.logs?.late ?? []) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,$3,1,$4)', [randomUUID(), id, sym, new Date(now.getTime() - 2 * 86400_000).toISOString()]);
  }
}

describe('pilot analytics (de-identified, k >= 10, research consent only)', () => {
  it('hides everything below 10 consenting people; people without research consent never count', async () => {
    const d2 = await pgliteDb(); await migrate(d2);
    // a fresh database for this assertion
    for (let i = 0; i < 9; i++) { const id = randomUUID(); await d2.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, onboarded) VALUES ($1,$2,'e',1975,'en',TRUE)", [id, sha(id)]); await d2.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'research_atlas',TRUE)", [id]); }
    for (let i = 0; i < 30; i++) { const id = randomUUID(); await d2.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, onboarded) VALUES ($1,$2,'e',1975,'en',TRUE)", [id, sha(id)]); }
    const p = await buildPilot(d2, now); await d2.close();
    expect(p.suppressed).toBe(true); expect(p.cohort).toBeNull(); expect(p.mrs).toBeNull(); expect(p.week4ActivePct).toBeNull();
  });
  it('computes MRS change, week-4 use and time to first consultation when enough people consent, and labels targets as hypotheses', async () => {
    await cohort(24, { logs: { early: ['hot_flash', 'poor_sleep', 'fatigue', 'low_mood'], late: ['hot_flash'] }, consultAfter: 20 });
    const p = await buildPilot(db, now);
    expect(p.suppressed).toBe(false); expect(p.cohort! % 5).toBe(0);
    expect(p.mrs).not.toBeNull(); expect(p.mrs!.currentMean).toBeLessThan(p.mrs!.baselineMean); expect(p.mrs!.changePct).toBeLessThan(0);
    expect(p.week4ActivePct).toBe(100); expect(p.medianDaysToFirstConsult).toBe(20);
    expect(p.signalAcceptancePct).toBeNull(); // no signals yet: not enough to show
    expect(p.targets).toMatch(/hypotheses/);
  });
  it('contains no ids or personal fields', async () => { expect(JSON.stringify(await buildPilot(db, now))).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}|user_id|phone/); });
});

describe('Symptom Atlas export', () => {
  it('only consented people; small cells hidden; counts rounded; nothing identifying', async () => {
    await cohort(3, { stage: 'surgical_early', logs: { early: ['hot_flash'], late: [] } }); // a tiny cell
    const csv = await buildAtlasCsv(db, now);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('age_band,stage,symptom,users_reporting,users_in_cell,share_pct');
    expect(lines.some((l) => l.startsWith('50-54,perimenopause,hot_flash,') && !l.includes('hidden'))).toBe(true);
    const tiny = lines.filter((l) => l.includes(',surgical_early,'));
    expect(tiny.length).toBeGreaterThan(0); expect(tiny.every((l) => l.split(',').slice(3).every((c) => c === 'hidden'))).toBe(true);
    for (const l of lines.slice(1)) for (const c of l.split(',').slice(3)) expect(c === 'hidden' || Number(c) % 5 === 0).toBe(true);
    expect(csv).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}|phone|@/);
  });
  it('is admin-only and downloads as CSV', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/admin/atlas.csv' })).statusCode).toBe(401);
    const r = await app.inject({ method: 'GET', url: '/api/admin/atlas.csv', headers: { cookie: await login() } });
    expect(r.headers['content-type']).toContain('text/csv'); expect(r.headers['content-disposition']).toContain('attachment');
  });
});

describe('self-reported consultation', () => {
  it('"I have seen my doctor" is recorded once, and never overwritten', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919700000002' } });
    const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919700000002', code: '123456', birthYear: 1978 } });
    const h = { cookie: String(v.headers['set-cookie']).split(';')[0], 'x-csrf-token': v.json().csrf };
    expect((await app.inject({ method: 'POST', url: '/api/me/consultation', headers: h })).json().recorded).toBe(true);
    const first = (await db.query<{ first_consult_at: string }>("SELECT first_consult_at FROM users WHERE phone_hash <> '' ORDER BY created_at DESC LIMIT 1"))[0].first_consult_at;
    await app.inject({ method: 'POST', url: '/api/me/consultation', headers: h });
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM audit_log WHERE action='consultation_reported'"))[0].n).toBe(1);
    expect(first).toBeTruthy();
  });
});
