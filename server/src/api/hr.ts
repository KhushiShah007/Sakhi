import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { K_MIN, suppress } from '../privacy/kanon.js';
import { mrsFromLogs, type Symptom } from '../safety/mrs.js';
import type { Ctx } from './family.js';
import { istDay } from './home.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const floorTo = (n: number, step: number) => Math.floor(n / step) * step;
const HR_COOKIE = 'sakhi_hr';

export const THEMES: { id: string; label: string; symptoms: Symptom[] }[] = [
  { id: 'sleep', label: 'Sleep', symptoms: ['poor_sleep', 'night_waking'] },
  { id: 'fatigue', label: 'Fatigue', symptoms: ['fatigue'] },
  { id: 'hot_flashes', label: 'Hot flashes', symptoms: ['hot_flash', 'night_sweats'] },
  { id: 'focus', label: 'Focus', symptoms: ['brain_fog'] },
  { id: 'joint_pain', label: 'Joint pain', symptoms: ['joint_pain', 'muscle_ache'] },
  { id: 'mood', label: 'Low mood or anxiety', symptoms: ['low_mood', 'anxiety'] },
];

export interface HrSummary {
  suppressed: boolean; k: number; employer: string; eligible: number;
  participants: number | null; participationPct: number | null; checkInsPerWeek: number | null; wellbeingIndex: number | null;
  themes: { id: string; label: string; pct: number | null; hidden: boolean }[];
  locations: { name: string; participants: number | null; wellbeingIndex: number | null; hidden: boolean }[];
  otherLocations: number | null; flexiSupported: number; resources: { title: string; status: string }[]; note: string;
}

interface Member { user_id: string; location: string }
interface Log { user_id: string; symptom: Symptom; severity: number; at: string }

/**
 * THE ONLY place HR numbers are produced. Rules enforced here, in the query layer, not in the UI:
 *  1. only people who opted in AND whose consent is currently granted are counted (withdrawal removes them at once);
 *  2. fewer than K=10 participants anywhere => everything is hidden;
 *  3. any group or theme with fewer than K people is hidden; complementary suppression stops "total minus the rest" recovering a hidden group;
 *  4. counts are rounded (participants/groups down to 5, percentages to 5), so one person joining or leaving does not move a number;
 *  5. the result contains no user ids, names, dates, symptom text or individual rows. Ever.
 */
export async function buildHrSummary(db: Db, employerId: string, now: Date): Promise<HrSummary> {
  const e = (await db.query<{ name: string; eligible: number; flexi_supported: number; resources: { title: string; status: string }[] }>('SELECT name, eligible, flexi_supported, resources FROM employers WHERE id=$1', [employerId]))[0];
  const base: HrSummary = { suppressed: true, k: K_MIN, employer: e.name, eligible: e.eligible, participants: null, participationPct: null, checkInsPerWeek: null, wellbeingIndex: null, themes: THEMES.map((t) => ({ id: t.id, label: t.label, pct: null, hidden: true })), locations: [], otherLocations: null, flexiSupported: e.flexi_supported, resources: e.resources, note: 'Indicative aggregates of people who opted in. Not clinical, not a diagnosis, and never individual data.' };

  const members = await db.query<Member>(
    `SELECT m.user_id, m.location FROM employer_members m
     WHERE m.employer_id=$1 AND COALESCE((SELECT granted FROM consents c WHERE c.user_id=m.user_id AND c.purpose='employer_aggregate' ORDER BY c.id DESC LIMIT 1), FALSE)`, [employerId]);
  const n = members.length;
  if (n < K_MIN) return base;

  const ids = new Set(members.map((m) => m.user_id));
  const from = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const logs = (await db.query<Log>('SELECT user_id, symptom, severity, at FROM logs WHERE at >= $1 AND user_id IN (SELECT user_id FROM employer_members WHERE employer_id=$2)', [from, employerId])).filter((l) => ids.has(l.user_id));
  const checks = await db.query<{ user_id: string; day: string }>("SELECT user_id, to_char(day,'YYYY-MM-DD') AS day FROM checkins WHERE day >= $1 AND user_id IN (SELECT user_id FROM employer_members WHERE employer_id=$2)", [istDay(new Date(now.getTime() - 28 * 86400_000)), employerId]);

  const logsBy = new Map<string, Log[]>();
  for (const l of logs) logsBy.set(l.user_id, [...(logsBy.get(l.user_id) ?? []), l]);
  const withLogs = [...ids].filter((u) => logsBy.has(u));
  const wellbeing = (users: string[]) => {
    const totals = users.map((u) => mrsFromLogs((logsBy.get(u) ?? []).map((l) => ({ symptom: l.symptom, severity: l.severity, at: l.at }))).total);
    return Math.round(100 * (1 - totals.reduce((a, b) => a + b, 0) / totals.length / 44));
  };

  // check-in days per person per week over the last 28 days (logs + one-tap check-ins)
  const day28 = istDay(new Date(now.getTime() - 27 * 86400_000));
  const dayKeys = new Set<string>([...logs.map((l) => `${l.user_id}|${istDay(new Date(l.at))}`).filter((k) => k.split('|')[1] >= day28), ...checks.map((c) => `${c.user_id}|${c.day}`).filter((k) => k.split('|')[1] >= day28)]);

  const out: HrSummary = { ...base, suppressed: false };
  out.participants = floorTo(n, 5);
  out.participationPct = Math.min(100, roundTo((out.participants / e.eligible) * 100, 5));
  out.checkInsPerWeek = Math.round((dayKeys.size / n / 4) * 10) / 10;

  if (withLogs.length >= K_MIN) {
    out.wellbeingIndex = roundTo(wellbeing(withLogs), 5);
    out.themes = THEMES.map((t) => {
      const count = withLogs.filter((u) => (logsBy.get(u) ?? []).some((l) => t.symptoms.includes(l.symptom))).length;
      return count < K_MIN ? { id: t.id, label: t.label, pct: null, hidden: true } : { id: t.id, label: t.label, pct: roundTo((count / withLogs.length) * 100, 5), hidden: false };
    });
  }

  // locations: hide small groups, then complementary suppression, then publish a combined "other" only if it is itself big enough
  const byLoc = new Map<string, string[]>();
  for (const m of members) byLoc.set(m.location, [...(byLoc.get(m.location) ?? []), m.user_id]);
  const groups = [...byLoc.entries()].map(([key, us]) => ({ key, count: us.length }));
  const sup = suppress(groups, n);
  const visibleSum = sup.groups.reduce((a, g) => a + (g.count ?? 0), 0);
  out.locations = sup.groups.map((g) => {
    if (g.suppressed) return { name: g.key, participants: null, wellbeingIndex: null, hidden: true };
    const us = byLoc.get(g.key)!;
    const wl = us.filter((u) => logsBy.has(u));
    return { name: g.key, participants: floorTo(g.count!, 5), wellbeingIndex: wl.length >= K_MIN ? roundTo(wellbeing(wl), 5) : null, hidden: false };
  });
  const rest = n - visibleSum;
  out.otherLocations = sup.groups.some((g) => g.suppressed) && rest >= K_MIN ? floorTo(rest, 5) : null;
  return out;
}

export function reportCsv(s: HrSummary): string {
  const q = (v: unknown) => (v === null || v === undefined ? 'hidden' : String(v).includes(',') ? `"${v}"` : String(v));
  const rows: unknown[][] = [['metric', 'value'], ['employer', s.employer], ['k_anonymity_threshold', s.k], ['eligible_headcount', s.eligible], ['participants_rounded', s.participants], ['participation_pct', s.participationPct], ['checkins_per_person_per_week', s.checkInsPerWeek], ['wellbeing_index', s.wellbeingIndex],
    ...s.themes.map((t) => [`theme_${t.id}_pct`, t.pct]), ...s.locations.flatMap((l) => [[`location_${l.name}_participants`, l.participants], [`location_${l.name}_wellbeing`, l.wellbeingIndex]]), ['other_locations_participants', s.otherLocations], ['flexi_requests_supported_entered_by_hr', s.flexiSupported]];
  return rows.map((r) => r.map(q).join(',')).join('\n') + '\n';
}

export function registerHr(app: FastifyInstance, c: Ctx) {
  const { db, now } = c;
  const prod = c.env.NODE_ENV === 'production';
  const cookieOf = (req: FastifyRequest) => (req.headers.cookie ?? '').split(';').map((x) => x.trim().split('=')).find((p) => p[0] === HR_COOKIE)?.[1] ?? '';
  const employerOf = async (req: FastifyRequest) => {
    const t = cookieOf(req);
    return t ? (await db.query<{ employer_id: string }>('SELECT employer_id FROM hr_sessions WHERE token_hash=$1 AND expires_at > $2', [sha(t), now().toISOString()]))[0]?.employer_id ?? null : null;
  };

  // ---- HR side: access code -> cookie session -> aggregates only
  app.post('/api/hr/login', async (req, reply) => {
    const b = z.object({ code: z.string().trim().min(6).max(80) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    if (c.limited(`hrlogin:${req.ip}`, 8, 10 * 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    const h = sha(b.data.code);
    const emp = (await db.query<{ id: string; name: string; hr_code_hash: string }>('SELECT id, name, hr_code_hash FROM employers')).find((x) => safeEq(x.hr_code_hash, h));
    if (!emp) return reply.code(401).send({ error: 'invalid_code' });
    const token = randomBytes(32).toString('base64url');
    await db.query('INSERT INTO hr_sessions(token_hash, employer_id, expires_at) VALUES ($1,$2,$3)', [sha(token), emp.id, new Date(now().getTime() + 8 * 3600_000).toISOString()]);
    reply.header('set-cookie', `${HR_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/hr; Max-Age=${8 * 3600}${prod ? '; Secure' : ''}`);
    return { employer: emp.name };
  });
  app.post('/api/hr/logout', async (req, reply) => {
    const t = cookieOf(req); if (t) await db.query('DELETE FROM hr_sessions WHERE token_hash=$1', [sha(t)]);
    reply.header('set-cookie', `${HR_COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/hr; Max-Age=0`);
    return { ok: true };
  });
  app.get('/api/hr/summary', async (req, reply) => { const e = await employerOf(req); return e ? buildHrSummary(db, e, now()) : reply.code(401).send({ error: 'unauthenticated' }); });
  app.get('/api/hr/report.csv', async (req, reply) => {
    const e = await employerOf(req); if (!e) return reply.code(401).send({ error: 'unauthenticated' });
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="sakhi-workplace-report.csv"').send(reportCsv(await buildHrSummary(db, e, now())));
  });

  // ---- employee side: opt in with the employer's invite code (needs the employer_aggregate consent), leave any time
  const lookup = async (code: string) => (await db.query<{ id: string; name: string; locations: string[] }>('SELECT id, name, locations FROM employers WHERE invite_code=$1', [code.trim().toUpperCase()]))[0];
  app.get('/api/employer/lookup', c.guarded, async (req, reply) => {
    const code = String((req.query as { code?: string }).code ?? '');
    if (c.limited(`emplookup:${req.auth!.userId}`, 20, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    const e = code ? await lookup(code) : undefined;
    return e ? { name: e.name, locations: e.locations } : reply.code(404).send({ error: 'not_found' });
  });
  app.get('/api/employer/membership', c.guarded, async (req) => {
    const m = (await db.query<{ name: string; location: string }>('SELECT e.name, m.location FROM employer_members m JOIN employers e ON e.id=m.employer_id WHERE m.user_id=$1', [req.auth!.userId]))[0];
    return { membership: m ?? null };
  });
  app.post('/api/employer/join', c.guarded, async (req, reply) => {
    const b = z.object({ code: z.string().trim().min(3).max(40), location: z.string().trim().min(1).max(60) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await c.hasConsent(userId, 'employer_aggregate' as never))) return reply.code(403).send({ error: 'consent_required', purpose: 'employer_aggregate' });
    const e = await lookup(b.data.code);
    if (!e || !e.locations.includes(b.data.location)) return reply.code(404).send({ error: 'not_found' });
    await db.query('INSERT INTO employer_members(user_id, employer_id, location) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET employer_id=$2, location=$3', [userId, e.id, b.data.location]);
    await c.audit(userId, 'user', 'employer_joined', 'aggregate_only');
    return { joined: true, employer: e.name };
  });
  app.delete('/api/employer/membership', c.guarded, async (req, reply) => {
    const r = await db.query('DELETE FROM employer_members WHERE user_id=$1 RETURNING user_id', [req.auth!.userId]);
    if (!r.length) return reply.code(404).send({ error: 'not_found' });
    await c.audit(req.auth!.userId, 'user', 'employer_left', 'aggregate_only');
    return { left: true };
  });
}
