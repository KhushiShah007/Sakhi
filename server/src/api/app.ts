import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LANGS, assertSafeBoot, type Lang } from '../config.js';
import type { Db } from '../db/index.js';
import type { LlmProvider } from '../llm/provider.js';
import { decrypt, encrypt, keyFromEnv } from '../privacy/crypto.js';
import { confirmEntries, handleUtterance, type ProposedEntry } from '../safety/pipeline.js';
import { mrsFromLogs, type ConfirmedLog, type Symptom } from '../safety/mrs.js';
import { next20Years, ruleOutQuestions } from '../safety/ruleout.js';
import { messengerFromEnv, registerFamily, type Messenger } from './family.js';

export const PURPOSES = ['core_logging', 'family_signals', 'doctor_brief', 'employer_aggregate', 'research_atlas', 'store_audio'] as const;
type Purpose = (typeof PURPOSES)[number];

export interface AppDeps { db: Db; llm: LlmProvider | null; env?: NodeJS.ProcessEnv; now?: () => Date; messenger?: Messenger }
interface Auth { userId: string; csrf: string }
declare module 'fastify' { interface FastifyRequest { auth?: Auth } }

const COOKIE = 'sakhi_session';
const DEMO_OTP = '123456';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const phoneSchema = z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\+?\d{10,13}$/));
const langSchema = z.enum(LANGS as [Lang, ...Lang[]]);

export async function buildApp({ db, llm, env = process.env, now = () => new Date(), messenger = messengerFromEnv(env) }: AppDeps): Promise<FastifyInstance> {
  assertSafeBoot(env);
  const key = keyFromEnv(env);
  const prod = env.NODE_ENV === 'production';
  const demoAuth = env.DEMO_AUTH === 'true';
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 }); // never log request bodies: they hold her words
  const phoneHash = (p: string) => createHmac('sha256', key).update(p).digest('hex');

  /** Unconfirmed proposals are stored encrypted (AES-GCM, bound to owner + id), single use, 15 min TTL. Not a log entry until she confirms. */
  const PROPOSAL_TTL_MS = 15 * 60_000;
  const saveProposals = async (id: string, userId: string, proposals: ProposedEntry[]) => {
    await db.query('DELETE FROM proposal_sets WHERE expires_at < $1', [now().toISOString()]);
    await db.query('INSERT INTO proposal_sets(id, user_id, data_enc, expires_at) VALUES ($1,$2,$3,$4)',
      [id, userId, encrypt(JSON.stringify(proposals), key, `proposals:${userId}:${id}`), new Date(now().getTime() + PROPOSAL_TTL_MS).toISOString()]);
  };
  const takeProposals = async (id: string, userId: string): Promise<ProposedEntry[] | null> => {
    const r = (await db.query<{ data_enc: string }>('DELETE FROM proposal_sets WHERE id=$1 AND user_id=$2 AND expires_at > $3 RETURNING data_enc', [id, userId, now().toISOString()]))[0];
    return r ? (JSON.parse(decrypt(r.data_enc, key, `proposals:${userId}:${id}`)) as ProposedEntry[]) : null;
  };
  const hits = new Map<string, { n: number; reset: number }>();
  const limited = (k: string, max: number, windowMs: number) => {
    const t = now().getTime();
    const h = hits.get(k);
    if (!h || h.reset < t) { hits.set(k, { n: 1, reset: t + windowMs }); return false; }
    return ++h.n > max;
  };

  const audit = (userId: string, actor: string, action: string, resource: string) =>
    db.query('INSERT INTO audit_log(user_id, actor, action, resource, at) VALUES ($1,$2,$3,$4,$5)', [userId, actor, action, resource, now().toISOString()]);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff').header('x-frame-options', 'DENY').header('referrer-policy', 'no-referrer')
      .header('cache-control', 'no-store').header('permissions-policy', 'camera=(), geolocation=(self), microphone=(self)')
      .header('content-security-policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    if (prod) reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
  });

  app.addHook('onRequest', async (req, reply) => {
    if (limited(`ip:${req.ip}`, Number(env.RATE_LIMIT_PER_MIN) || 120, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
  });

  const cookies = (req: FastifyRequest): Record<string, string> =>
    Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)]));

  const setCookie = (reply: FastifyReply, token: string, maxAge: number) =>
    reply.header('set-cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${prod ? '; Secure' : ''}`);

  /** Session + CSRF (double submit: x-csrf-token must equal the value bound to the session) on every state-changing request. */
  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const token = cookies(req)[COOKIE];
    const rows = token ? await db.query<{ user_id: string; csrf: string }>('SELECT user_id, csrf FROM sessions WHERE token_hash=$1 AND expires_at > $2', [sha(token), now().toISOString()]) : [];
    if (!rows.length) return reply.code(401).send({ error: 'unauthenticated' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const sent = String(req.headers['x-csrf-token'] ?? '');
      if (!safeEq(sent, rows[0].csrf)) return reply.code(403).send({ error: 'csrf' });
    }
    req.auth = { userId: rows[0].user_id, csrf: rows[0].csrf };
  }
  const guarded = { preHandler: requireAuth };
  const bad = (reply: FastifyReply, e: unknown) => reply.code(400).send({ error: 'invalid_input', issues: e instanceof z.ZodError ? e.issues.map((i) => i.path.join('.')) : undefined });

  const hasConsent = async (userId: string, purpose: Purpose) => {
    const r = await db.query<{ granted: boolean }>('SELECT granted FROM consents WHERE user_id=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1', [userId, purpose]);
    return r[0]?.granted === true;
  };

  app.get('/healthz', async () => ({ ok: true, demoAuth, llm: llm?.name ?? 'rules' }));

  // ---------- auth ----------
  app.post('/api/auth/otp/request', async (req, reply) => {
    const body = z.object({ phone: phoneSchema }).safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    const ph = phoneHash(body.data.phone);
    if (limited(`otp:${ph}`, 5, 10 * 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    let code: string;
    if (demoAuth) code = DEMO_OTP;
    else if (env.OTP_WEBHOOK_URL) {
      code = String(randomBytes(4).readUInt32BE() % 1_000_000).padStart(6, '0');
      const res = await fetch(env.OTP_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OTP_WEBHOOK_TOKEN ?? ''}` }, body: JSON.stringify({ phone: body.data.phone, code }) }).catch(() => null);
      if (!res?.ok) return reply.code(502).send({ error: 'otp_delivery_failed' });
    } else return reply.code(503).send({ error: 'otp_not_configured', hint: 'Set OTP_WEBHOOK_URL, or DEMO_AUTH=true outside production' });
    await db.query(
      `INSERT INTO otps(phone_hash, code_hash, expires_at, attempts) VALUES ($1,$2,$3,0)
       ON CONFLICT (phone_hash) DO UPDATE SET code_hash=$2, expires_at=$3, attempts=0`,
      [ph, sha(code), new Date(now().getTime() + 5 * 60_000).toISOString()]);
    return { sent: true };
  });

  app.post('/api/auth/otp/verify', async (req, reply) => {
    const body = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/), birthYear: z.number().int().min(1900).max(2100).optional(), lang: langSchema.optional() }).safeParse(req.body);
    if (!body.success) return bad(reply, body.error);
    const { phone, code, birthYear, lang } = body.data;
    const ph = phoneHash(phone);
    const otp = (await db.query<{ code_hash: string; expires_at: string; attempts: number }>('SELECT code_hash, expires_at, attempts FROM otps WHERE phone_hash=$1', [ph]))[0];
    if (!otp || otp.attempts >= 5 || new Date(otp.expires_at) < now()) return reply.code(401).send({ error: 'invalid_code' });
    if (!safeEq(sha(code), otp.code_hash)) {
      await db.query('UPDATE otps SET attempts = attempts + 1 WHERE phone_hash=$1', [ph]);
      return reply.code(401).send({ error: 'invalid_code' });
    }
    let user = (await db.query<{ id: string }>('SELECT id FROM users WHERE phone_hash=$1', [ph]))[0];
    if (!user) {
      if (birthYear === undefined) return reply.code(400).send({ error: 'birth_year_required' });
      if (now().getFullYear() - birthYear < 18) return reply.code(403).send({ error: 'under_18' }); // no account, nothing stored
      user = { id: randomUUID() };
      await db.query('INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang) VALUES ($1,$2,$3,$4,$5)', [user.id, ph, encrypt(phone, key, `phone:${user.id}`), birthYear, lang ?? 'hi']);
      await audit(user.id, 'user', 'account_created', 'user');
    }
    await db.query('DELETE FROM otps WHERE phone_hash=$1', [ph]);
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(24).toString('base64url');
    await db.query('INSERT INTO sessions(token_hash, user_id, csrf, expires_at) VALUES ($1,$2,$3,$4)', [sha(token), user.id, csrf, new Date(now().getTime() + 30 * 86400_000).toISOString()]);
    setCookie(reply, token, 30 * 86400);
    return { csrf };
  });

  app.post('/api/auth/logout', guarded, async (req, reply) => {
    const token = cookies(req)[COOKIE];
    if (token) await db.query('DELETE FROM sessions WHERE token_hash=$1', [sha(token)]);
    setCookie(reply, '', 0);
    return { ok: true };
  });

  // ---------- profile ----------
  app.get('/api/me', guarded, async (req) => {
    const u = (await db.query('SELECT id, lang, stage, city, discreet, created_at FROM users WHERE id=$1', [req.auth!.userId]))[0];
    return { ...u, demoMode: env.DEMO_MODE === 'true' };
  });

  app.patch('/api/me', guarded, async (req, reply) => {
    const b = z.object({ lang: langSchema, stage: z.enum(['perimenopause', 'menopause', 'surgical_early', 'no_family']), city: z.string().trim().min(1).max(60), discreet: z.boolean() }).partial().strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    for (const [k, v] of Object.entries(b.data)) await db.query(`UPDATE users SET ${k}=$1 WHERE id=$2`, [v, req.auth!.userId]); // keys are whitelisted by the schema
    await audit(req.auth!.userId, 'user', 'update', 'profile');
    return { ok: true };
  });

  // ---------- consent ----------
  app.get('/api/consents', guarded, async (req) => {
    const history = await db.query<{ purpose: Purpose; granted: boolean; at: string }>('SELECT purpose, granted, at FROM consents WHERE user_id=$1 ORDER BY id', [req.auth!.userId]);
    const current = Object.fromEntries(PURPOSES.map((p) => [p, history.filter((h) => h.purpose === p).at(-1)?.granted ?? false]));
    return { current, history };
  });

  app.post('/api/consents', guarded, async (req, reply) => {
    const b = z.object({ purpose: z.enum(PURPOSES), granted: z.boolean() }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    await db.query('INSERT INTO consents(user_id, purpose, granted, at) VALUES ($1,$2,$3,$4)', [req.auth!.userId, b.data.purpose, b.data.granted, now().toISOString()]);
    await audit(req.auth!.userId, 'user', b.data.granted ? 'consent_granted' : 'consent_withdrawn', b.data.purpose);
    return { ok: true };
  });

  // ---------- talk -> propose -> confirm -> log ----------
  app.post('/api/utterance', guarded, async (req, reply) => {
    const b = z.object({ text: z.string().min(1).max(2000), lang: langSchema.optional() }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if (limited(`utt:${userId}`, 30, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    const lang = b.data.lang ?? ((await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [userId]))[0].lang);
    // Safety rules run even without consent: a crisis reply must never be withheld.
    const result = await handleUtterance(b.data.text, lang, llm, env);
    if (result.kind === 'crisis') return result; // nothing stored, no flag persisted anywhere
    if (result.kind === 'refusal') { await audit(userId, 'system', 'utterance_refused', result.violation); return result; }
    if (!(await hasConsent(userId, 'core_logging'))) return reply.code(403).send({ error: 'consent_required', purpose: 'core_logging' });
    const setId = randomUUID();
    await saveProposals(setId, userId, result.proposals);
    await audit(userId, 'system', 'utterance_processed', 'proposals'); // metadata only, never the text
    return { ...result, setId };
  });

  app.post('/api/logs/confirm', guarded, async (req, reply) => {
    const b = z.object({ setId: z.string().uuid(), decisions: z.array(z.object({ id: z.string(), accept: z.boolean(), severity: z.number().int().min(0).max(4).optional() }).strict()).max(20) }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await hasConsent(userId, 'core_logging'))) return reply.code(403).send({ error: 'consent_required', purpose: 'core_logging' });
    const proposals = await takeProposals(b.data.setId, userId); // atomic delete-returning: single use
    if (!proposals) return reply.code(404).send({ error: 'proposal_set_not_found' });
    const logs = confirmEntries(proposals, b.data.decisions, now());
    for (const l of logs) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), userId, l.symptom, l.severity, l.at]);
    await audit(userId, 'user', 'confirm_logs', `count:${logs.length}`);
    return { saved: logs.length };
  });

  const loadLogs = async (userId: string, days: number): Promise<ConfirmedLog[]> =>
    (await db.query<{ symptom: Symptom; severity: number; at: string }>('SELECT symptom, severity, at FROM logs WHERE user_id=$1 AND at >= $2 ORDER BY at', [userId, new Date(now().getTime() - days * 86400_000).toISOString()]))
      .map((r) => ({ symptom: r.symptom, severity: r.severity, at: new Date(r.at).toISOString() }));

  app.get('/api/logs', guarded, async (req) => { await audit(req.auth!.userId, 'user', 'read', 'logs'); return { logs: await loadLogs(req.auth!.userId, 90) }; });

  app.get('/api/brief', guarded, async (req, reply) => {
    const userId = req.auth!.userId;
    if (!(await hasConsent(userId, 'doctor_brief'))) return reply.code(403).send({ error: 'consent_required', purpose: 'doctor_brief' });
    const logs = await loadLogs(userId, 30);
    const mrs = mrsFromLogs(logs);
    const u = (await db.query<{ birth_year: number }>('SELECT birth_year FROM users WHERE id=$1', [userId]))[0];
    await audit(userId, 'user', 'read', 'brief');
    return {
      source: 'her own confirmed logs, last 30 days', mrs, ruleOutQuestions: ruleOutQuestions({ mrs, weeksOfLogs: 4 }),
      next20Years: next20Years(now().getFullYear() - u.birth_year),
      footer: 'Supportive, not diagnostic. Rule-out questions are pending clinician review.', clinicianReviewed: false,
    };
  });

  // ---------- her rights: audit trail, export, deletion ----------
  app.get('/api/audit', guarded, async (req) => ({ entries: await db.query('SELECT actor, action, resource, at FROM audit_log WHERE user_id=$1 ORDER BY id DESC LIMIT 200', [req.auth!.userId]) }));

  app.get('/api/export', guarded, async (req) => {
    const userId = req.auth!.userId;
    await audit(userId, 'user', 'export', 'all');
    const user = (await db.query<{ phone_enc: string } & Record<string, unknown>>('SELECT id, phone_enc, birth_year, lang, stage, city, discreet, created_at FROM users WHERE id=$1', [userId]))[0];
    const { phone_enc, ...profile } = user;
    return {
      exportedAt: now().toISOString(), profile: { ...profile, phone: decrypt(phone_enc, key, `phone:${userId}`) },
      logs: await db.query('SELECT symptom, severity, at FROM logs WHERE user_id=$1 ORDER BY at', [userId]),
      consents: await db.query('SELECT purpose, granted, at FROM consents WHERE user_id=$1 ORDER BY id', [userId]),
      audit: await db.query('SELECT actor, action, resource, at FROM audit_log WHERE user_id=$1 ORDER BY id', [userId]),
    };
  });

  app.delete('/api/me', guarded, async (req, reply) => {
    const userId = req.auth!.userId;
    const tomb = `deleted:${sha(userId).slice(0, 16)}`;
    await db.query('UPDATE audit_log SET user_id=$1 WHERE user_id=$2', [tomb, userId]); // trail survives, identity does not
    await db.query('DELETE FROM users WHERE id=$1', [userId]); // cascades logs, consents, sessions
    await audit(tomb, 'user', 'account_deleted', 'user');
    setCookie(reply, '', 0);
    return { deleted: true };
  });

  registerFamily(app, { db, key, env, now, messenger, audit, guarded, bad, hasConsent, limited });

  return app;
}
