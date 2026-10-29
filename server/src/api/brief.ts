import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { LANGS, type Lang } from '../config.js';
import { BAND_NAME, HEAD, HIGHLIGHT, MRS_ITEM_NAME, NEXT20_TEXT, QUESTIONS, RULE_OUT_TEXT, STAGE_NAME, SUBSCALE_NAME, TIME_PHRASE, TRIGGER_NAME, fill } from '../content/brief.js';
import type { Db } from '../db/index.js';
import { decrypt, encrypt } from '../privacy/crypto.js';
import { renderBriefPdf } from '../providers/pdf.js';
import { MRS_ITEMS, MRS_SUBSCALE, MRS_SUBSCALE_MAX, mrsFromLogs, subscaleBand, type MrsBand, type MrsItem, type MrsResult, type MrsSubscale } from '../safety/mrs.js';
import { next20Years, ruleOutQuestions } from '../safety/ruleout.js';
import type { Ctx } from './family.js';
import { istDay, loadRecentLogs, type LogRow } from './home.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10);

export interface BriefData {
  lang: Lang; generatedAt: string; periodFrom: string; periodTo: string; checkInDays: number; lowData: boolean;
  patient: { name: string; age: number; city: string | null; stageLabel: string };
  mrs: MrsResult;
  total: { score: number; max: 44; band: MrsBand; bandLabel: string };
  subscales: { id: MrsSubscale; name: string; score: number; max: number; band: MrsBand; bandLabel: string }[];
  items: { id: MrsItem; name: string; score: number; subscale: MrsSubscale }[];
  timeline: { week: number; hotFlashDays: number; poorSleepDays: number; load: number }[];
  highlights: string[];
  ruleOut: { id: string; question: string; because: string; reviewed: false }[];
  questions: string[];
  next20: { id: string; title: string; action: string }[];
  headings: { title: string; mrs: string; timeline: string; ruleOut: string; questions: string; next20: string; next20Sub: string; source: string; footer: string; period: string; total: string };
  clinicianReviewed: false;
}

const mode = (xs: string[]) => { const m = new Map<string, number>(); xs.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };

/** Pure: everything on the brief is derived by rules from her confirmed logs. No LLM, no free text. */
export function composeBrief(args: { rows: LogRow[]; today: string; name: string; age: number; city: string | null; stage: string | null; lang: Lang; now: Date }): BriefData {
  const { rows, today, lang } = args;
  const from = addDays(today, -29);
  const win = rows.filter((r) => { const d = istDay(new Date(r.at)); return d >= from && d <= today; });
  const dayOf = (r: LogRow) => istDay(new Date(r.at));
  const days = (pred: (r: LogRow) => boolean) => new Set(win.filter(pred).map(dayOf)).size;
  const checkInDays = new Set(win.map(dayOf)).size;

  const mrs = mrsFromLogs(win.map((r) => ({ symptom: r.symptom, severity: r.severity, at: r.at })));
  const items = MRS_ITEMS.map((id) => ({ id, name: MRS_ITEM_NAME[id][lang], score: mrs.items[id], subscale: MRS_SUBSCALE[id] }));
  const subscales = (['somatic', 'psychological', 'urogenital'] as const).map((id) => {
    const band = subscaleBand(id, mrs[id]);
    return { id, name: SUBSCALE_NAME[id][lang], score: mrs[id], max: MRS_SUBSCALE_MAX[id], band, bandLabel: BAND_NAME[band][lang] };
  });

  const timeline = [1, 2, 3, 4].map((week) => {
    const start = addDays(today, -27 + (week - 1) * 7), end = addDays(start, 6); // 4 x 7 days, the last ending today
    const w = win.filter((r) => { const d = dayOf(r); return d >= start && d <= end; });
    const dcount = (pred: (r: LogRow) => boolean) => new Set(w.filter(pred).map(dayOf)).size;
    return { week, hotFlashDays: dcount((r) => r.symptom === 'hot_flash' || r.symptom === 'night_sweats'), poorSleepDays: dcount((r) => r.symptom === 'poor_sleep' || r.symptom === 'night_waking'), load: w.reduce((a, r) => a + r.severity, 0) };
  });

  const dn = (n: number) => (lang === 'en' ? `${n} day${n === 1 ? '' : 's'}` : String(n)); // English templates read "on 1 day" / "on 6 days"
  const highlights: string[] = [];
  if (checkInDays < 5) highlights.push(checkInDays === 1 ? HIGHLIGHT.few1[lang] : fill(HIGHLIGHT.few[lang], { n: checkInDays }));
  const hotDays = days((r) => r.symptom === 'hot_flash' || r.symptom === 'night_sweats');
  if (hotDays) {
    const when = mode(win.filter((r) => (r.symptom === 'hot_flash' || r.symptom === 'night_sweats') && r.time_of_day !== 'unspecified').map((r) => r.time_of_day));
    highlights.push(fill(HIGHLIGHT.hot[lang], { n: hotDays, d: 30, when: when ? fill(HIGHLIGHT.when[lang], { time: TIME_PHRASE[when][lang] }) : '' }));
  }
  const sleepDays = days((r) => r.symptom === 'poor_sleep' || r.symptom === 'night_waking'); if (sleepDays) highlights.push(fill(HIGHLIGHT.sleep[lang], { n: dn(sleepDays) }));
  const painDays = days((r) => r.symptom === 'joint_pain' || r.symptom === 'muscle_ache'); if (painDays) highlights.push(fill(HIGHLIGHT.pain[lang], { n: dn(painDays) }));
  const moodDays = days((r) => r.symptom === 'low_mood' || r.symptom === 'anxiety'); if (moodDays) highlights.push(fill(HIGHLIGHT.mood[lang], { n: dn(moodDays) }));
  const trig = mode(win.map((r) => r.trigger).filter((t) => TRIGGER_NAME[t])); if (trig) highlights.push(fill(HIGHLIGHT.trigger[lang], { t: TRIGGER_NAME[trig][lang] }));

  const ro = ruleOutQuestions({ mrs, weeksOfLogs: 4 }).map((q) => ({ id: q.id, question: RULE_OUT_TEXT[q.id]?.q[lang] ?? q.question, because: RULE_OUT_TEXT[q.id]?.because[lang] ?? q.because, reviewed: false as const }));
  const H = Object.fromEntries(Object.entries(HEAD).map(([k, v]) => [k, v[lang]])) as Record<keyof typeof HEAD, string>;
  return {
    lang, generatedAt: args.now.toISOString(), periodFrom: from, periodTo: today, checkInDays, lowData: checkInDays < 5,
    patient: { name: args.name, age: args.age, city: args.city, stageLabel: args.stage ? (STAGE_NAME[args.stage]?.[lang] ?? '') : '' },
    mrs, total: { score: mrs.total, max: 44, band: mrs.band, bandLabel: BAND_NAME[mrs.band][lang] }, subscales, items, timeline, highlights,
    ruleOut: ro, questions: QUESTIONS.map((q) => q[lang]),
    next20: next20Years(args.age).map((n) => ({ id: n.id, title: NEXT20_TEXT[n.id]?.title[lang] ?? n.title, action: NEXT20_TEXT[n.id]?.action[lang] ?? n.action })),
    headings: { title: H.title, mrs: H.mrs, timeline: H.timeline, ruleOut: H.ruleOut, questions: H.questions, next20: H.next20, next20Sub: H.next20Sub, source: H.source, footer: H.footer, period: H.period, total: H.total },
    clinicianReviewed: false,
  };
}

export function registerBrief(app: FastifyInstance, c: Ctx) {
  const { db, key, now } = c;
  const baseFor = (req: FastifyRequest) => (c.env.PUBLIC_URL ? c.env.PUBLIC_URL.replace(/\/$/, '') : `${String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0]}://${req.headers.host}`);

  const build = async (userId: string, lang: Lang) => {
    const u = (await db.query<{ name: string | null; birth_year: number; city: string | null; stage: string | null }>('SELECT name, birth_year, city, stage FROM users WHERE id=$1', [userId]))[0];
    const clock = now();
    const rows = await loadRecentLogs(db, userId, clock, 40);
    return composeBrief({ rows, today: istDay(clock), name: u.name ?? '', age: clock.getFullYear() - u.birth_year, city: u.city, stage: u.stage, lang, now: clock });
  };
  const consent = async (userId: string) => (await db.query<{ granted: boolean }>("SELECT granted FROM consents WHERE user_id=$1 AND purpose='doctor_brief' ORDER BY id DESC LIMIT 1", [userId]))[0]?.granted === true;
  const langQ = (req: FastifyRequest): Lang => { const l = (req.query as { lang?: string }).lang; return (LANGS as string[]).includes(l ?? '') ? (l as Lang) : 'en'; };

  app.get('/api/brief', c.guarded, async (req, reply) => {
    const userId = req.auth!.userId;
    if (!(await consent(userId))) return reply.code(403).send({ error: 'consent_required', purpose: 'doctor_brief' });
    const lang = langQ(req);
    const b = await build(userId, lang);
    await c.audit(userId, 'user', 'read', 'brief');
    // `ruleOutQuestions`, `footer` and `source` keep the original English fields for older clients
    return { ...b, source: b.headings.source, footer: b.headings.footer, ruleOutQuestions: b.ruleOut };
  });

  app.get('/api/brief.pdf', c.guarded, async (req, reply) => {
    const userId = req.auth!.userId;
    if (!(await consent(userId))) return reply.code(403).send({ error: 'consent_required', purpose: 'doctor_brief' });
    const pdf = await renderBriefPdf(await build(userId, 'en'));
    await c.audit(userId, 'user', 'export', 'brief_pdf');
    return reply.header('content-type', 'application/pdf').header('content-disposition', 'attachment; filename="sakhi-doctor-brief.pdf"').send(pdf);
  });

  // ---- share with a doctor by link (frozen English snapshot, 7 days, revocable)
  app.post('/api/brief/share', c.guarded, async (req, reply) => {
    const userId = req.auth!.userId;
    if (!(await consent(userId))) return reply.code(403).send({ error: 'consent_required', purpose: 'doctor_brief' });
    const snapshot = await build(userId, 'en');
    const id = randomUUID(); const token = randomBytes(24).toString('base64url');
    const expires = new Date(now().getTime() + 7 * 86400_000);
    await db.query('INSERT INTO brief_shares(id, user_id, token_hash, data_enc, expires_at) VALUES ($1,$2,$3,$4,$5)', [id, userId, sha(token), encrypt(JSON.stringify(snapshot), key, `brief:${id}`), expires.toISOString()]);
    await c.audit(userId, 'user', 'brief_shared', 'brief_share');
    return reply.code(201).send({ id, link: `${baseFor(req)}/b/${token}`, expiresAt: expires.toISOString() });
  });

  app.get('/api/brief/shares', c.guarded, async (req) => ({
    shares: (await db.query<{ id: string; created_at: string; expires_at: string; revoked_at: string | null }>('SELECT id, created_at, expires_at, revoked_at FROM brief_shares WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.auth!.userId]))
      .map((s) => ({ id: s.id, createdAt: new Date(s.created_at).toISOString(), expiresAt: new Date(s.expires_at).toISOString(), active: !s.revoked_at && new Date(s.expires_at) > now() })),
  }));

  app.delete('/api/brief/shares/:id', c.guarded, async (req, reply) => {
    const r = await db.query('UPDATE brief_shares SET revoked_at=$3 WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id', [(req.params as { id: string }).id, req.auth!.userId, now().toISOString()]);
    if (!r.length) return reply.code(404).send({ error: 'not_found' });
    await c.audit(req.auth!.userId, 'user', 'brief_share_revoked', 'brief_share');
    return { revoked: true };
  });

  /** Public doctor link. Unknown, expired and revoked all answer the same 410. */
  app.get('/b/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || c.limited(`brief:${sha(token)}`, 30, 60_000)) return reply.code(410).send({ error: 'link_inactive' });
    const row = (await db.query<{ id: string; user_id: string; data_enc: string }>('SELECT id, user_id, data_enc FROM brief_shares WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > $2', [sha(token), now().toISOString()]))[0];
    if (!row) return reply.code(410).send({ error: 'link_inactive' });
    await c.audit(row.user_id, 'doctor-link', 'read', 'brief_share');
    const pdf = await renderBriefPdf(JSON.parse(decrypt(row.data_enc, key, `brief:${row.id}`)) as BriefData);
    return reply.header('content-type', 'application/pdf').header('content-disposition', 'inline; filename="sakhi-doctor-brief.pdf"').header('x-robots-tag', 'noindex').send(pdf);
  });
}

