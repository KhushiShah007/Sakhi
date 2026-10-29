import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { buildHrSummary, reportCsv } from '../src/api/hr.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { noWeather } from '../src/providers/weather.js';

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 3).toString('base64') } as NodeJS.ProcessEnv;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
let db: Db; let app: FastifyInstance; const now = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => now, weather: noWeather, tts: null }); });
afterAll(async () => { await app.close(); await db.close(); });

let empN = 0;
async function employer(locations: string[], code = `HR-CODE-${++empN}-secret`) {
  const id = `emp${empN}`;
  await db.query('INSERT INTO employers(id, name, invite_code, hr_code_hash, eligible, locations, flexi_supported, resources) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [id, `Employer ${empN}`, `INV${empN}`, sha(code), 1000, locations, 12, JSON.stringify([{ title: 'Flexi policy', status: 'Live' }])]);
  return { id, code, invite: `INV${empN}` };
}
/** `n` synthetic people at one location; `logsFor` symptoms are logged by the first `withLogs` of them. */
async function people(empId: string, location: string, n: number, opts: { consent?: boolean; withLogs?: number; symptoms?: string[] } = {}) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = randomUUID(); ids.push(id);
    await db.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, onboarded) VALUES ($1,$2,'enc',1975,'en',TRUE)", [id, sha(id)]);
    if (opts.consent !== false) await db.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'employer_aggregate',TRUE)", [id]);
    await db.query('INSERT INTO employer_members(user_id, employer_id, location) VALUES ($1,$2,$3)', [id, empId, location]);
    if (i < (opts.withLogs ?? n)) for (const sym of opts.symptoms ?? ['hot_flash']) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,$3,3,$4)', [randomUUID(), id, sym, new Date(now.getTime() - 3 * 86400_000).toISOString()]);
  }
  return ids;
}

describe('k-anonymity at the query layer', () => {
  it('fewer than 10 participants: everything is hidden, nothing leaks', async () => {
    const e = await employer(['A']); await people(e.id, 'A', 9);
    const s = await buildHrSummary(db, e.id, now);
    expect(s.suppressed).toBe(true); expect(s.participants).toBeNull(); expect(s.wellbeingIndex).toBeNull(); expect(s.checkInsPerWeek).toBeNull(); expect(s.themes.every((t) => t.hidden && t.pct === null)).toBe(true); expect(s.locations).toEqual([]);
  });
  it('exactly 10 shows; withdrawing one consent drops below 10 and hides it again at once', async () => {
    const e = await employer(['A']); const ids = await people(e.id, 'A', 10);
    expect((await buildHrSummary(db, e.id, now)).suppressed).toBe(false);
    await db.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'employer_aggregate',FALSE)", [ids[0]]);
    expect((await buildHrSummary(db, e.id, now)).suppressed).toBe(true);
  });
  it('members who never granted the consent are never counted, even if they joined', async () => {
    const e = await employer(['A']); await people(e.id, 'A', 9); await people(e.id, 'A', 20, { consent: false });
    expect((await buildHrSummary(db, e.id, now)).suppressed).toBe(true);
  });
  it('rounds counts so one person joining or leaving does not move the numbers', async () => {
    const e = await employer(['A']); await people(e.id, 'A', 41);
    const a = await buildHrSummary(db, e.id, now); await people(e.id, 'A', 1); const b = await buildHrSummary(db, e.id, now);
    expect(a.participants).toBe(40); expect(b.participants).toBe(40); expect(a.participationPct).toBe(b.participationPct);
    for (const n of [a.participants!, b.participants!]) expect(n % 5).toBe(0);
  });
  it('a small location is hidden and cannot be recovered by subtraction (complementary suppression)', async () => {
    const e = await employer(['Big', 'Mid', 'Tiny']);
    await people(e.id, 'Big', 20); await people(e.id, 'Mid', 12); await people(e.id, 'Tiny', 7);
    const s = await buildHrSummary(db, e.id, now);
    expect(s.participants).toBe(35); // 39 -> 35
    const tiny = s.locations.find((l) => l.name === 'Tiny')!; expect(tiny.hidden && tiny.participants === null && tiny.wellbeingIndex === null).toBe(true);
    expect(s.locations.filter((l) => l.hidden).length).toBeGreaterThanOrEqual(2); // not just the small one: otherwise total - Big - Mid = Tiny
    expect(s.locations.find((l) => l.name === 'Big')!.participants).toBe(20);
    expect(s.otherLocations).toBe(15); // 19 combined, rounded down; only published because it is itself >= 10
    expect(JSON.stringify(s)).not.toMatch(/\b7\b/); // the tiny group's size appears nowhere
  });
  it('a combined "other" under 10 is not published either', async () => {
    const e = await employer(['Big', 'T1', 'T2']);
    await people(e.id, 'Big', 30); await people(e.id, 'T1', 4); await people(e.id, 'T2', 3);
    const s = await buildHrSummary(db, e.id, now);
    expect(s.otherLocations).toBeNull(); expect(s.locations.filter((l) => l.hidden).length).toBe(2);
  });
  it('themes under 10 reporters are hidden; larger ones are shown as rounded percentages', async () => {
    const e = await employer(['A']);
    const ids = await people(e.id, 'A', 30, { withLogs: 30, symptoms: ['hot_flash'] });
    for (const id of ids.slice(0, 6)) await db.query("INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,'brain_fog',2,$3)", [randomUUID(), id, now.toISOString()]);
    const s = await buildHrSummary(db, e.id, now);
    const hot = s.themes.find((t) => t.id === 'hot_flashes')!; const focus = s.themes.find((t) => t.id === 'focus')!;
    expect(hot.hidden).toBe(false); expect(hot.pct).toBe(100); expect(focus.hidden).toBe(true); expect(focus.pct).toBeNull();
  });
  it('wellbeing is hidden when fewer than 10 people have logs, even if 10+ participate', async () => {
    const e = await employer(['A']); await people(e.id, 'A', 20, { withLogs: 8 });
    const s = await buildHrSummary(db, e.id, now);
    expect(s.suppressed).toBe(false); expect(s.wellbeingIndex).toBeNull(); expect(s.themes.every((t) => t.hidden)).toBe(true);
  });
  it('the result never contains ids, phone hashes, dates, symptom keys or individual rows', async () => {
    const e = await employer(['A', 'B']); const a = await people(e.id, 'A', 25, { symptoms: ['hot_flash', 'poor_sleep'] }); const b = await people(e.id, 'B', 15);
    const json = JSON.stringify(await buildHrSummary(db, e.id, now));
    for (const id of [...a, ...b]) { expect(json).not.toContain(id); expect(json).not.toContain(sha(id)); }
    expect(json).not.toMatch(/hot_flash|poor_sleep|2026-|user_id|phone/);
  });
  it('wellbeing moves in the right direction and stays on a 0-100 scale', async () => {
    const light = await employer(['A']); await people(light.id, 'A', 15, { symptoms: ['headache'] });
    const heavy = await employer(['A']); await people(heavy.id, 'A', 15, { symptoms: ['hot_flash', 'poor_sleep', 'fatigue', 'low_mood', 'anxiety', 'irritability', 'joint_pain', 'palpitations'] });
    const l = (await buildHrSummary(db, light.id, now)).wellbeingIndex!; const h = (await buildHrSummary(db, heavy.id, now)).wellbeingIndex!;
    expect(l).toBeGreaterThan(h); expect(l).toBeLessThanOrEqual(100); expect(h).toBeGreaterThanOrEqual(0);
  });
  it('the exported report is the same suppressed data, with hidden cells marked, never more', async () => {
    const e = await employer(['Big', 'Tiny']); await people(e.id, 'Big', 25); await people(e.id, 'Tiny', 4);
    const csv = reportCsv(await buildHrSummary(db, e.id, now));
    expect(csv).toContain('location_Tiny_participants,hidden'); expect(csv).toContain('k_anonymity_threshold,10'); expect(csv).not.toMatch(/user|phone|[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});

describe('HR access and the employee opt-in flow', () => {
  it('HR logs in with the employer code, gets a cookie scoped to /api/hr, and sees only their own employer', async () => {
    const e1 = await employer(['A']); await people(e1.id, 'A', 20); const e2 = await employer(['A']); await people(e2.id, 'A', 40);
    expect((await app.inject({ method: 'GET', url: '/api/hr/summary' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/hr/login', payload: { code: 'not-the-code-123' } })).statusCode).toBe(401);
    const r = await app.inject({ method: 'POST', url: '/api/hr/login', payload: { code: e1.code } });
    expect(r.statusCode).toBe(200); const set = String(r.headers['set-cookie']); expect(set).toMatch(/HttpOnly/); expect(set).toMatch(/Path=\/api\/hr/); expect(set).toMatch(/SameSite=Strict/);
    const cookie = set.split(';')[0];
    const s = (await app.inject({ method: 'GET', url: '/api/hr/summary', headers: { cookie } })).json();
    expect(s.employer).toBe(e1.id.replace('emp', 'Employer ')); expect(s.participants).toBe(20);
    const csv = await app.inject({ method: 'GET', url: '/api/hr/report.csv', headers: { cookie } });
    expect(csv.headers['content-type']).toContain('text/csv'); expect(csv.body).toContain('participants_rounded,20');
    await app.inject({ method: 'POST', url: '/api/hr/logout', headers: { cookie } });
    expect((await app.inject({ method: 'GET', url: '/api/hr/summary', headers: { cookie } })).statusCode).toBe(401);
  });
  it('wrong HR codes are rate limited', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await app.inject({ method: 'POST', url: '/api/hr/login', payload: { code: `wrong-code-${i}-xx` }, remoteAddress: '10.9.9.9' })).statusCode);
    expect(codes[0]).toBe(401); expect(codes[9]).toBe(429);
  });
  it('an employee opts in with the invite code; consent is required; she can leave; withdrawing consent removes her from the numbers', async () => {
    const e = await employer(['Pune', 'Surat']); await people(e.id, 'Pune', 12);
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919900000001' } });
    const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919900000001', code: '123456', birthYear: 1978 } });
    const s = { cookie: String(v.headers['set-cookie']).split(';')[0], csrf: v.json().csrf };
    const call = (m: 'GET' | 'POST' | 'DELETE', u: string, p?: unknown) => app.inject({ method: m, url: u, payload: p as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
    expect((await call('GET', `/api/employer/lookup?code=${e.invite.toLowerCase()}`)).json()).toEqual({ name: `Employer ${empN}`, locations: ['Pune', 'Surat'] });
    expect((await call('GET', '/api/employer/lookup?code=NOPE')).statusCode).toBe(404);
    expect((await call('POST', '/api/employer/join', { code: e.invite, location: 'Pune' })).statusCode).toBe(403); // no opt-in consent yet
    await call('POST', '/api/consents', { purpose: 'employer_aggregate', granted: true });
    expect((await call('POST', '/api/employer/join', { code: e.invite, location: 'Mars' })).statusCode).toBe(404);
    expect((await call('POST', '/api/employer/join', { code: e.invite, location: 'Pune' })).json().joined).toBe(true);
    expect((await call('GET', '/api/employer/membership')).json().membership).toMatchObject({ location: 'Pune' });
    expect((await buildHrSummary(db, e.id, now)).participants).toBe(10); // 13 -> 10
    await call('POST', '/api/consents', { purpose: 'employer_aggregate', granted: false });
    expect((await buildHrSummary(db, e.id, now)).participants).toBe(10); // 12 -> 10, her consent no longer counts
    const countAfter = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM employer_members m WHERE m.employer_id=$1 AND COALESCE((SELECT granted FROM consents c WHERE c.user_id=m.user_id AND c.purpose='employer_aggregate' ORDER BY c.id DESC LIMIT 1), FALSE)", [e.id]))[0].n;
    expect(countAfter).toBe(12);
    expect((await call('DELETE', '/api/employer/membership')).json().left).toBe(true);
    expect((await call('DELETE', '/api/employer/membership')).statusCode).toBe(404);
    expect(JSON.stringify((await call('GET', '/api/audit')).json())).toContain('employer_joined');
  });
  it('deleting an account removes the membership', async () => {
    const e = await employer(['Pune']); await people(e.id, 'Pune', 10);
    await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone: '+919900000002' } });
    const v = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone: '+919900000002', code: '123456', birthYear: 1978 } });
    const h = { cookie: String(v.headers['set-cookie']).split(';')[0], 'x-csrf-token': v.json().csrf };
    await app.inject({ method: 'POST', url: '/api/consents', headers: h, payload: { purpose: 'employer_aggregate', granted: true } });
    await app.inject({ method: 'POST', url: '/api/employer/join', headers: h, payload: { code: e.invite, location: 'Pune' } });
    expect((await db.query('SELECT 1 FROM employer_members WHERE employer_id=$1', [e.id])).length).toBe(11);
    await app.inject({ method: 'DELETE', url: '/api/me', headers: h });
    expect((await db.query('SELECT 1 FROM employer_members WHERE employer_id=$1', [e.id])).length).toBe(10);
  });
});
