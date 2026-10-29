import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LANGS, type Lang } from '../config.js';
import { TRIGGER_NAME, fill } from '../content/brief.js';
import { LETTER, SYMPTOM_NAME } from '../content/letter.js';
import type { Db } from '../db/index.js';
import { decrypt, encrypt } from '../privacy/crypto.js';
import type { Symptom } from '../safety/mrs.js';
import type { Ctx } from './family.js';
import { istDay, type LogRow } from './home.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const monthOf = (day: string) => day.slice(0, 7);
export const prevMonth = (month: string) => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

export interface LetterData { month: string; lang: Lang; paragraphs: string[]; sign: string; stats: { checkInDays: number; signalsSent: number; signalsAnswered: number; topSymptoms: string[] } }

/**
 * Pure and deterministic: a strengths-based letter built from her CONFIRMED logs and check-ins for one calendar month (India time).
 * It names symptoms in a gentle list, never quotes anything she said, never diagnoses, and never invents a trend.
 */
export function composeLetter(a: { rows: LogRow[]; checkinDays: string[]; signals: { sent: number; answered: number }; name: string; lang: Lang; month: string }): LetterData {
  const { lang, month } = a;
  const inMonth = a.rows.filter((r) => monthOf(istDay(new Date(r.at))) === month);
  const days = new Set([...inMonth.map((r) => istDay(new Date(r.at))), ...a.checkinDays.filter((d) => monthOf(d) === month)]);
  const n = days.size;
  const dn = lang === 'en' ? `${n} day${n === 1 ? '' : 's'}` : String(n);
  const paras: string[] = [];
  const top: Symptom[] = [];
  if (n === 0) paras.push(LETTER.none[lang]);
  else {
    paras.push(fill(LETTER.checkins[lang], { n: dn }));
    const load = new Map<Symptom, number>();
    for (const r of inMonth) load.set(r.symptom, (load.get(r.symptom) ?? 0) + r.severity);
    top.push(...[...load.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s]) => s));
    if (top.length) paras.push(fill(LETTER.noticed[lang], { list: top.map((s) => SYMPTOM_NAME[s][lang]).join(', ') }));
    const trig = [...inMonth.map((r) => r.trigger).filter((t) => TRIGGER_NAME[t]).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((x, y) => y[1] - x[1])[0]?.[0];
    if (trig) paras.push(fill(LETTER.trigger[lang], { t: TRIGGER_NAME[trig][lang].toLowerCase() }));
    if (a.signals.sent > 0) paras.push(fill(LETTER.family[lang], { k: a.signals.sent, d: a.signals.answered }));
    // an honest trend: only when both halves have data, and only "lighter" when it really is lighter
    const mid = `${month}-16`;
    const load1 = inMonth.filter((r) => istDay(new Date(r.at)) < mid).reduce((s, r) => s + r.severity, 0);
    const load2 = inMonth.filter((r) => istDay(new Date(r.at)) >= mid).reduce((s, r) => s + r.severity, 0);
    if (load1 > 0 && load2 > 0) paras.push(load2 < load1 ? LETTER.better[lang] : LETTER.steady[lang]);
  }
  paras.push(LETTER.close[lang]);
  return { month, lang, paragraphs: paras.map((p) => p), sign: LETTER.sign[lang], stats: { checkInDays: n, signalsSent: a.signals.sent, signalsAnswered: a.signals.answered, topSymptoms: top } };
}

/** Builds and stores (encrypted) one user's letter for a month. Returns the greeting-ready data. */
export async function generateLetter(db: Db, key: Buffer, userId: string, month: string, lang: Lang, now: Date): Promise<LetterData & { id: string }> {
  const u = (await db.query<{ name: string | null }>('SELECT name FROM users WHERE id=$1', [userId]))[0];
  const from = new Date(Date.parse(`${month}-01T00:00:00Z`) - 86400_000).toISOString();
  const to = new Date(Date.parse(`${month}-01T00:00:00Z`) + 33 * 86400_000).toISOString();
  const rows = await db.query<LogRow>('SELECT symptom, severity, at, trigger, time_of_day FROM logs WHERE user_id=$1 AND at >= $2 AND at <= $3 ORDER BY at', [userId, from, to]);
  const checks = (await db.query<{ day: string }>("SELECT to_char(day,'YYYY-MM-DD') AS day FROM checkins WHERE user_id=$1 AND to_char(day,'YYYY-MM')=$2", [userId, month])).map((r) => r.day);
  const sig = (await db.query<{ sent: number; answered: number }>("SELECT count(*)::int AS sent, count(*) FILTER (WHERE done_at IS NOT NULL)::int AS answered FROM signals WHERE user_id=$1 AND to_char(sent_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM')=$2", [userId, month]))[0];
  const data = composeLetter({ rows, checkinDays: checks, signals: sig, name: u?.name ?? '', lang, month });
  const existing = (await db.query<{ id: string }>('SELECT id FROM letters WHERE user_id=$1 AND month=$2', [userId, month]))[0];
  const id = existing?.id ?? randomUUID();
  const greeting = fill(LETTER.greeting[lang], { name: u?.name ?? '' }).replace(/\s+,/, ',').replace(/ ,/, ',');
  const body = encrypt(JSON.stringify({ ...data, greeting }), key, `letter:${id}`);
  await db.query('INSERT INTO letters(id, user_id, month, body_enc, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, month) DO UPDATE SET body_enc=$4, created_at=$5', [id, userId, month, body, now.toISOString()]);
  return { ...data, id, ...({ greeting } as object) } as LetterData & { id: string };
}

/**
 * The monthly job: for everyone who allowed logging, write last month's letter if it does not exist yet and there is something to say.
 * Idempotent, so it can run every hour and the first run after midnight on the 1st does the work.
 */
export async function generateDueLetters(db: Db, key: Buffer, now: Date): Promise<number> {
  const month = prevMonth(monthOf(istDay(now)));
  const users = await db.query<{ id: string; lang: Lang }>(
    `SELECT u.id, u.lang FROM users u
     WHERE u.onboarded AND COALESCE((SELECT granted FROM consents c WHERE c.user_id=u.id AND c.purpose='core_logging' ORDER BY c.id DESC LIMIT 1), FALSE)
       AND NOT EXISTS (SELECT 1 FROM letters l WHERE l.user_id=u.id AND l.month=$1)
       AND (EXISTS (SELECT 1 FROM logs g WHERE g.user_id=u.id AND to_char(g.at AT TIME ZONE 'Asia/Kolkata','YYYY-MM')=$1)
         OR EXISTS (SELECT 1 FROM checkins k WHERE k.user_id=u.id AND to_char(k.day,'YYYY-MM')=$1))`, [month]);
  for (const u of users) await generateLetter(db, key, u.id, month, u.lang, now);
  return users.length;
}

export function registerLetters(app: FastifyInstance, c: Ctx) {
  const { db, key, now } = c;
  const base = (req: FastifyRequest) => (c.env.PUBLIC_URL ? c.env.PUBLIC_URL.replace(/\/$/, '') : `${String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0]}://${req.headers.host}`);
  const open = async (userId: string, month: string) => {
    const r = (await db.query<{ id: string; body_enc: string }>('SELECT id, body_enc FROM letters WHERE user_id=$1 AND month=$2', [userId, month]))[0];
    return r ? { id: r.id, ...(JSON.parse(decrypt(r.body_enc, key, `letter:${r.id}`)) as LetterData & { greeting: string }) } : null;
  };
  const consent = async (userId: string) => c.hasConsent(userId, 'core_logging' as never);

  app.get('/api/letters', c.guarded, async (req) => ({ letters: (await db.query<{ month: string; created_at: string }>('SELECT month, created_at FROM letters WHERE user_id=$1 ORDER BY month DESC LIMIT 24', [req.auth!.userId])).map((l) => ({ month: l.month, createdAt: new Date(l.created_at).toISOString() })) }));

  app.post('/api/letters/generate', c.guarded, async (req, reply) => {
    const b = z.object({ month: z.string().regex(MONTH_RE).optional(), lang: z.enum(LANGS as [Lang, ...Lang[]]).optional() }).strict().safeParse(req.body ?? {});
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await consent(userId))) return reply.code(403).send({ error: 'consent_required', purpose: 'core_logging' });
    const month = b.data.month ?? monthOf(istDay(now()));
    if (month > monthOf(istDay(now()))) return reply.code(400).send({ error: 'future_month' });
    const lang = b.data.lang ?? (await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [userId]))[0].lang;
    const l = await generateLetter(db, key, userId, month, lang, now());
    await c.audit(userId, 'user', 'letter_generated', month);
    return l;
  });

  app.get('/api/letters/:month', c.guarded, async (req, reply) => {
    const month = (req.params as { month: string }).month;
    if (!MONTH_RE.test(month)) return reply.code(400).send({ error: 'invalid_input' });
    const l = await open(req.auth!.userId, month);
    if (!l) return reply.code(404).send({ error: 'not_found' });
    await c.audit(req.auth!.userId, 'user', 'read', 'letter');
    return l;
  });

  // sharing is HER choice, per letter, expiring and revocable
  app.post('/api/letters/:month/share', c.guarded, async (req, reply) => {
    const month = (req.params as { month: string }).month;
    const userId = req.auth!.userId;
    const l = MONTH_RE.test(month) ? await open(userId, month) : null;
    if (!l) return reply.code(404).send({ error: 'not_found' });
    const id = randomUUID(); const token = randomBytes(24).toString('base64url'); const expires = new Date(now().getTime() + 7 * 86400_000);
    await db.query('INSERT INTO letter_shares(id, user_id, letter_id, token_hash, expires_at) VALUES ($1,$2,$3,$4,$5)', [id, userId, l.id, sha(token), expires.toISOString()]);
    await c.audit(userId, 'user', 'letter_shared', month);
    return reply.code(201).send({ id, link: `${base(req)}/l/${token}`, expiresAt: expires.toISOString() });
  });
  app.delete('/api/letters/shares/:id', c.guarded, async (req, reply) => {
    const r = await db.query('UPDATE letter_shares SET revoked_at=$3 WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id', [(req.params as { id: string }).id, req.auth!.userId, now().toISOString()]);
    return r.length ? { revoked: true } : reply.code(404).send({ error: 'not_found' });
  });

  /** Public, read-only, noindex page for a letter she chose to share. Unknown/expired/revoked all look the same. */
  app.get('/l/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || c.limited(`letter:${sha(token)}`, 30, 60_000)) return reply.code(410).send({ error: 'link_inactive' });
    const s = (await db.query<{ user_id: string; letter_id: string }>('SELECT user_id, letter_id FROM letter_shares WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > $2', [sha(token), now().toISOString()]))[0];
    if (!s) return reply.code(410).send({ error: 'link_inactive' });
    const r = (await db.query<{ body_enc: string }>('SELECT body_enc FROM letters WHERE id=$1', [s.letter_id]))[0];
    const l = JSON.parse(decrypt(r.body_enc, key, `letter:${s.letter_id}`)) as LetterData & { greeting: string };
    await c.audit(s.user_id, 'letter-link', 'read', 'letter_share');
    const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Letter</title><body style="font:19px/1.7 system-ui,'Noto Sans Devanagari','Noto Sans Gujarati',sans-serif;max-width:34rem;margin:2rem auto;padding:0 1.2rem;color:#3B1F2B;background:#FBEBDD"><p><b>${esc(l.greeting)}</b></p>${l.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}<p style="text-align:right"><b>${esc(l.sign)}</b></p>`;
    return reply.header('content-type', 'text/html; charset=utf-8').header('x-robots-tag', 'noindex').header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'").send(html);
  });
}
