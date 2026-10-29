import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CARD_TEXT, CARD_TYPES, LESSONS } from '../content/family.js';
import { RULE_OUT_TEXT } from '../content/brief.js';
import type { Db } from '../db/index.js';
import { K_MIN } from '../privacy/kanon.js';
import { SCRIPTS } from '../safety/redflags.js';
import { mrsFromLogs, SYMPTOMS, type Symptom } from '../safety/mrs.js';
import type { Ctx } from './family.js';
import { istDay } from './home.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const COOKIE = 'sakhi_admin';
const roundTo = (n: number, s: number) => Math.round(n / s) * s;
const floorTo = (n: number, s: number) => Math.floor(n / s) * s;
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

export const KINDS = ['right_now', 'signal_card', 'say_this', 'module', 'crisis_script', 'rule_out'] as const;
type Kind = (typeof KINDS)[number];

/** Everything the app can say to or about her, as it exists in code today. Registered as version 1, NOT clinician reviewed. */
export function catalogue(): { kind: Kind; key: string; title: string; body: unknown }[] {
  return [
    { kind: 'right_now', key: 'cooling-breath-90s', title: 'Cooling breath (90 seconds)', body: { seconds: 90, phases: [{ id: 'in', seconds: 4 }, { id: 'hold', seconds: 2 }, { id: 'out', seconds: 6 }], technique: 'paced breathing with cooling imagery' } },
    ...CARD_TYPES.map((t) => ({ kind: 'signal_card' as const, key: t, title: `Signal Card: ${t}`, body: CARD_TEXT[t] })),
    ...LESSONS.map((l) => ({ kind: (l.kind === 'say_this' || l.kind === 'repair' ? 'say_this' : 'module') as Kind, key: l.id, title: l.title.en, body: { title: l.title, points: l.points } })),
    ...Object.entries(RULE_OUT_TEXT).map(([k, v]) => ({ kind: 'rule_out' as const, key: k, title: v.q.en, body: v })),
    ...Object.entries(SCRIPTS).map(([k, v]) => ({ kind: 'crisis_script' as const, key: k, title: `Crisis script: ${k}`, body: v })),
  ];
}

export async function syncContent(db: Db): Promise<number> {
  let n = 0;
  for (const c of catalogue()) {
    const r = await db.query('INSERT INTO content_items(kind, key, version, title, body) VALUES ($1,$2,1,$3,$4) ON CONFLICT DO NOTHING RETURNING key', [c.kind, c.key, c.title, JSON.stringify(c.body)]);
    n += r.length;
  }
  return n;
}

export interface Pilot {
  suppressed: boolean; k: number; cohort: number | null;
  mrs: { baselineMean: number; currentMean: number; changePct: number; users: number } | null;
  week4ActivePct: number | null; signalAcceptancePct: number | null; huiPct: number | null; medianDaysToFirstConsult: number | null;
  targets: string;
}

/** De-identified pilot measures. Only people who consented to research ("research_atlas"); every figure needs >= K people/events or is hidden. */
export async function buildPilot(db: Db, now: Date): Promise<Pilot> {
  const base: Pilot = { suppressed: true, k: K_MIN, cohort: null, mrs: null, week4ActivePct: null, signalAcceptancePct: null, huiPct: null, medianDaysToFirstConsult: null, targets: 'Pilot targets (MRS down 15% or more, week-4 use 40% or more, signal acceptance 70% or more, HUI 60 or more, wait to first consultation halved) are hypotheses to test, not results.' };
  const users = await db.query<{ id: string; created_at: string; first_consult_at: string | null }>(
    `SELECT u.id, u.created_at, u.first_consult_at FROM users u WHERE u.onboarded AND COALESCE((SELECT granted FROM consents c WHERE c.user_id=u.id AND c.purpose='research_atlas' ORDER BY c.id DESC LIMIT 1), FALSE)`);
  if (users.length < K_MIN) return base;
  const ids = new Set(users.map((u) => u.id));
  const logs = (await db.query<{ user_id: string; symptom: Symptom; severity: number; at: string }>('SELECT user_id, symptom, severity, at FROM logs')).filter((l) => ids.has(l.user_id));
  const checks = (await db.query<{ user_id: string; day: string }>("SELECT user_id, to_char(day,'YYYY-MM-DD') AS day FROM checkins")).filter((c) => ids.has(c.user_id));
  const sigs = (await db.query<{ user_id: string; done_at: string | null; helped_at: string | null }>('SELECT user_id, done_at, helped_at FROM signals')).filter((s) => ids.has(s.user_id));
  const byUser = new Map<string, typeof logs>();
  for (const l of logs) byUser.set(l.user_id, [...(byUser.get(l.user_id) ?? []), l]);
  const DAY = 86400_000;
  const out: Pilot = { ...base, suppressed: false, cohort: floorTo(users.length, 5) };

  // MRS: first 10 days of HER log history vs the latest 10 days; only people whose windows do not overlap
  const pairs: [number, number][] = [];
  for (const [, ls] of byUser) {
    const first = new Date(ls[0].at).getTime();
    if (now.getTime() - first < 20 * DAY) continue;
    const early = ls.filter((l) => new Date(l.at).getTime() < first + 10 * DAY), late = ls.filter((l) => new Date(l.at).getTime() >= now.getTime() - 10 * DAY);
    if (!early.length || !late.length) continue;
    const m = (xs: typeof ls) => mrsFromLogs(xs.map((l) => ({ symptom: l.symptom, severity: l.severity, at: l.at }))).total;
    pairs.push([m(early), m(late)]);
  }
  if (pairs.length >= K_MIN) {
    const b = pairs.reduce((a, p) => a + p[0], 0) / pairs.length, c = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
    out.mrs = { baselineMean: Math.round(b * 10) / 10, currentMean: Math.round(c * 10) / 10, changePct: b > 0 ? Math.round(((c - b) / b) * 100) : 0, users: floorTo(pairs.length, 5) };
  }

  // week-4 active use: of people who signed up at least 28 days ago, the share with any activity in days 22-28 after signing up
  const old = users.filter((u) => now.getTime() - new Date(u.created_at).getTime() >= 28 * DAY);
  if (old.length >= K_MIN) {
    const active = old.filter((u) => {
      const c = new Date(u.created_at).getTime(), lo = c + 21 * DAY, hi = c + 28 * DAY;
      return (byUser.get(u.id) ?? []).some((l) => { const t = new Date(l.at).getTime(); return t >= lo && t < hi; }) || checks.some((k) => k.user_id === u.id && Date.parse(k.day) >= lo && Date.parse(k.day) < hi);
    }).length;
    out.week4ActivePct = roundTo((active / old.length) * 100, 5);
  }

  // family response
  if (sigs.length >= K_MIN && new Set(sigs.map((s) => s.user_id)).size >= K_MIN) {
    out.signalAcceptancePct = roundTo((sigs.filter((s) => s.done_at).length / sigs.length) * 100, 5);
    out.huiPct = roundTo((sigs.filter((s) => s.done_at && s.helped_at).length / sigs.length) * 100, 5);
  }
  const waits = users.filter((u) => u.first_consult_at).map((u) => (Date.parse(u.first_consult_at!) - new Date(u.created_at).getTime()) / DAY).filter((d) => d >= 0);
  if (waits.length >= K_MIN) out.medianDaysToFirstConsult = Math.round(median(waits));
  return out;
}

/** Menopause Symptom Atlas: consented, de-identified, aggregated. A cell is hidden unless >= K people are in it AND >= K report the symptom. */
export async function buildAtlasCsv(db: Db, now: Date): Promise<string> {
  const users = await db.query<{ id: string; birth_year: number; stage: string | null }>(
    `SELECT u.id, u.birth_year, u.stage FROM users u WHERE u.onboarded AND u.stage IS NOT NULL AND COALESCE((SELECT granted FROM consents c WHERE c.user_id=u.id AND c.purpose='research_atlas' ORDER BY c.id DESC LIMIT 1), FALSE)`);
  const ids = new Set(users.map((u) => u.id));
  const logs = (await db.query<{ user_id: string; symptom: Symptom }>('SELECT DISTINCT user_id, symptom FROM logs')).filter((l) => ids.has(l.user_id));
  const band = (by: number) => { const a = now.getFullYear() - by; return a < 45 ? 'under 45' : a < 50 ? '45-49' : a < 55 ? '50-54' : '55 and over'; };
  const cells = new Map<string, string[]>();
  for (const u of users) { const k = `${band(u.birth_year)}|${u.stage}`; cells.set(k, [...(cells.get(k) ?? []), u.id]); }
  const rows = ['age_band,stage,symptom,users_reporting,users_in_cell,share_pct'];
  for (const [k, us] of [...cells.entries()].sort()) {
    const [ab, stage] = k.split('|');
    for (const s of SYMPTOMS) {
      const rep = us.filter((id) => logs.some((l) => l.user_id === id && l.symptom === s)).length;
      const hide = us.length < K_MIN || rep < K_MIN;
      rows.push([ab, stage, s, hide ? 'hidden' : floorTo(rep, 5), us.length < K_MIN ? 'hidden' : floorTo(us.length, 5), hide ? 'hidden' : roundTo((rep / us.length) * 100, 5)].join(','));
    }
  }
  return rows.join('\n') + '\n';
}

export function registerAdmin(app: FastifyInstance, c: Ctx) {
  const { db, now } = c;
  const adminKey = c.env.ADMIN_KEY;
  const cookieOf = (req: FastifyRequest) => (req.headers.cookie ?? '').split(';').map((x) => x.trim().split('=')).find((p) => p[0] === COOKIE)?.[1] ?? '';
  const authed = async (req: FastifyRequest) => { const t = cookieOf(req); return !!t && (await db.query('SELECT 1 FROM admin_sessions WHERE token_hash=$1 AND expires_at > $2', [sha(t), now().toISOString()])).length > 0; };

  app.post('/api/admin/login', async (req, reply) => {
    if (!adminKey) return reply.code(503).send({ error: 'admin_disabled', hint: 'Set ADMIN_KEY to enable the admin console' });
    const b = z.object({ key: z.string().min(6).max(200) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    if (c.limited(`adminlogin:${req.ip}`, 6, 10 * 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    if (!safeEq(sha(b.data.key), sha(adminKey))) return reply.code(401).send({ error: 'invalid_key' });
    const token = randomBytes(32).toString('base64url');
    await db.query('INSERT INTO admin_sessions(token_hash, expires_at) VALUES ($1,$2)', [sha(token), new Date(now().getTime() + 4 * 3600_000).toISOString()]);
    reply.header('set-cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${4 * 3600}${c.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return { ok: true };
  });
  app.post('/api/admin/logout', async (req, reply) => { const t = cookieOf(req); if (t) await db.query('DELETE FROM admin_sessions WHERE token_hash=$1', [sha(t)]); reply.header('set-cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0`); return { ok: true }; });
  const guard = async (req: FastifyRequest, reply: import('fastify').FastifyReply) => { if (!(await authed(req))) return reply.code(401).send({ error: 'unauthenticated' }); };

  app.get('/api/admin/content', { preHandler: guard }, async () => {
    const rows = await db.query<{ kind: Kind; key: string; version: number; title: string; status: string; clinician_reviewed: boolean; reviewer: string | null; reviewed_at: string | null }>("SELECT kind, key, version, title, status, clinician_reviewed, reviewer, to_char(reviewed_at,'YYYY-MM-DD') AS reviewed_at FROM content_items ORDER BY kind, key, version");
    const by = new Map<string, typeof rows>();
    for (const r of rows) by.set(`${r.kind}|${r.key}`, [...(by.get(`${r.kind}|${r.key}`) ?? []), r]);
    const items = [...by.values()].map((vs) => {
      const live = [...vs].reverse().find((v) => v.status === 'live')!;
      return { kind: live.kind, key: live.key, title: live.title, liveVersion: live.version, versions: vs.map((v) => ({ version: v.version, status: v.status, clinicianReviewed: v.clinician_reviewed, reviewer: v.reviewer, reviewedAt: v.reviewed_at })), review: live.clinician_reviewed ? { state: 'reviewed', reviewer: live.reviewer, reviewedAt: live.reviewed_at } : { state: 'pending clinician review' } };
    });
    return { items, pending: items.filter((i) => i.review.state !== 'reviewed').length, total: items.length, note: 'Content served to users comes from the application code at the live version. Draft versions are NOT served until engineering publishes them.' };
  });

  app.post('/api/admin/content/review', { preHandler: guard }, async (req, reply) => {
    const b = z.object({ kind: z.enum(KINDS), key: z.string().max(80), version: z.number().int().min(1), reviewer: z.string().trim().min(3).max(80), reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    if (b.data.reviewedAt > istDay(now())) return reply.code(400).send({ error: 'review_date_in_future' }); // a review cannot be dated before it happens
    const r = await db.query('UPDATE content_items SET clinician_reviewed=TRUE, reviewer=$4, reviewed_at=$5 WHERE kind=$1 AND key=$2 AND version=$3 RETURNING key', [b.data.kind, b.data.key, b.data.version, b.data.reviewer, b.data.reviewedAt]);
    return r.length ? { ok: true } : reply.code(404).send({ error: 'not_found' });
  });

  app.post('/api/admin/content/version', { preHandler: guard }, async (req, reply) => {
    const b = z.object({ kind: z.enum(KINDS), key: z.string().max(80), title: z.string().trim().min(1).max(200).optional(), body: z.record(z.string(), z.unknown()) }).strict().safeParse(req.body);
    if (!b.success || JSON.stringify(b.data.body).length > 20_000) return c.bad(reply, b.success ? new Error('too large') : b.error);
    const cur = (await db.query<{ version: number; title: string }>('SELECT version, title FROM content_items WHERE kind=$1 AND key=$2 ORDER BY version DESC LIMIT 1', [b.data.kind, b.data.key]))[0];
    if (!cur) return reply.code(404).send({ error: 'not_found' });
    // a new version always starts UNREVIEWED and as a draft, whatever the previous version's status was
    await db.query("INSERT INTO content_items(kind, key, version, title, body, status, clinician_reviewed) VALUES ($1,$2,$3,$4,$5,'draft',FALSE)", [b.data.kind, b.data.key, cur.version + 1, b.data.title ?? cur.title, JSON.stringify(b.data.body)]);
    return reply.code(201).send({ version: cur.version + 1, status: 'draft' });
  });

  app.get('/api/admin/analytics', { preHandler: guard }, async () => buildPilot(db, now()));
  app.get('/api/admin/atlas.csv', { preHandler: guard }, async (_req, reply) => reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', 'attachment; filename="sakhi-symptom-atlas.csv"').send(await buildAtlasCsv(db, now())));

  // her side: "I have seen my doctor" (self-reported, once) feeds the pilot's wait-to-first-consultation measure
  app.post('/api/me/consultation', c.guarded, async (req) => {
    const r = await db.query('UPDATE users SET first_consult_at=$2 WHERE id=$1 AND first_consult_at IS NULL RETURNING id', [req.auth!.userId, istDay(now())]);
    if (r.length) await c.audit(req.auth!.userId, 'user', 'consultation_reported', 'self_reported');
    return { recorded: true };
  });
}
