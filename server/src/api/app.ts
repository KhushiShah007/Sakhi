import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LANGS, assertSafeBoot, type Lang } from '../config.js';
import type { Db } from '../db/index.js';
import type { LlmProvider } from '../llm/provider.js';
import { decrypt, encrypt, keyFromEnv } from '../privacy/crypto.js';
import { confirmEntries, handleUtterance, type ProposedEntry } from '../safety/pipeline.js';
import { TIMES, TRIGGERS, violatesOutputPolicy } from '../safety/validate.js';
import { CARD_TEXT, CARD_TYPES } from '../content/family.js';
import { SENTENCES, TONES, suggestCard, type Tone } from '../content/translate.js';
import { detectRedFlags, crisisResponse } from '../safety/redflags.js';
import { SYMPTOMS } from '../safety/mrs.js';
import { SYSTEM_PROMPT, models } from '../llm/provider.js';
import { mrsFromLogs, type ConfirmedLog, type Symptom } from '../safety/mrs.js';
import { next20Years, ruleOutQuestions } from '../safety/ruleout.js';
import { messengerFromEnv, registerFamily, type Messenger } from './family.js';
import { MAX_PIN_FAILS, PIN_LOCK_MS, PIN_RE, checkPin, hashPin } from '../privacy/pin.js';
import { registerCheckins, registerHome, registerMoments } from './home.js';
import { registerBrief } from './brief.js';
import { registerLetters } from './letters.js';
import { registerNight } from './night.js';
import { registerHr } from './hr.js';
import { registerAdmin } from './admin.js';
import { registerIvr } from './ivr.js';
import { weatherFromEnv, type WeatherProvider } from '../providers/weather.js';
import { pushFromEnv, type PushProvider } from '../providers/push.js';
import { registerReminders } from './reminders.js';
import { ttsFromEnv, type TtsAudio, type TtsProvider } from '../providers/tts.js';

export const PURPOSES = ['core_logging', 'family_signals', 'doctor_brief', 'employer_aggregate', 'research_atlas', 'store_audio'] as const;
type Purpose = (typeof PURPOSES)[number];

export interface AppDeps { db: Db; llm: LlmProvider | null; env?: NodeJS.ProcessEnv; now?: () => Date; messenger?: Messenger; weather?: WeatherProvider; tts?: TtsProvider | null; push?: PushProvider | null }
interface Auth { userId: string; csrf: string; locked: boolean }
const LOCKED_OK = new Set(['GET /api/me', 'POST /api/pin/verify', 'POST /api/lock', 'POST /api/auth/logout']);
declare module 'fastify' { interface FastifyRequest { auth?: Auth } }

const COOKIE = 'sakhi_session';
const DEMO_OTP = '123456';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const phoneSchema = z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\+?\d{10,13}$/));
const langSchema = z.enum(LANGS as [Lang, ...Lang[]]);

export async function buildApp({ db, llm, env = process.env, now = () => new Date(), messenger = messengerFromEnv(env), weather = weatherFromEnv(env), tts = ttsFromEnv(env), push = pushFromEnv(env) }: AppDeps): Promise<FastifyInstance> {
  assertSafeBoot(env);
  const key = keyFromEnv(env);
  const prod = env.NODE_ENV === 'production';
  const demoAuth = env.DEMO_AUTH === 'true';
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 }); // never log request bodies: they hold her words
  // Clients (fetch with a JSON content-type) often send bodyless POST/DELETE: treat an empty body as "no body", reject malformed JSON.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '') return done(null, undefined);
    try { done(null, JSON.parse(body as string)); } catch { done(Object.assign(new Error('invalid json'), { statusCode: 400 })); }
  });
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
      .header('content-security-policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self' blob:; worker-src 'self'; manifest-src 'self'; connect-src 'self' https://api.open-meteo.com https://air-quality-api.open-meteo.com; frame-ancestors 'none'; base-uri 'self'");
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
  const findSession = async (req: FastifyRequest) => {
    const token = cookies(req)[COOKIE];
    return token ? await db.query<{ user_id: string; csrf: string; locked: boolean }>('SELECT user_id, csrf, locked FROM sessions WHERE token_hash=$1 AND expires_at > $2', [sha(token), now().toISOString()]) : [];
  };
  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const rows = await findSession(req);
    if (!rows.length) return reply.code(401).send({ error: 'unauthenticated' });
    if (!['GET', 'HEAD'].includes(req.method)) {
      const sent = String(req.headers['x-csrf-token'] ?? '');
      if (!safeEq(sent, rows[0].csrf)) return reply.code(403).send({ error: 'csrf' });
    }
    // Discreet Mode: a locked session can do nothing except ask who it is, enter the PIN, lock again, or sign out.
    if (rows[0].locked && !LOCKED_OK.has(`${req.method} ${req.routeOptions.url ?? ''}`)) return reply.code(423).send({ error: 'locked' });
    req.auth = { userId: rows[0].user_id, csrf: rows[0].csrf, locked: rows[0].locked };
  }
  const guarded = { preHandler: requireAuth };
  const bad = (reply: FastifyReply, e: unknown) => reply.code(400).send({ error: 'invalid_input', issues: e instanceof z.ZodError ? e.issues.map((i) => i.path.join('.')) : undefined });

  const hasConsent = async (userId: string, purpose: Purpose) => {
    const r = await db.query<{ granted: boolean }>('SELECT granted FROM consents WHERE user_id=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1', [userId, purpose]);
    return r[0]?.granted === true;
  };

  app.get('/healthz', async () => ({ ok: true, demoAuth, llm: llm?.name ?? 'rules', tts: tts ? 'server' : 'browser', push: !!push })); // provider kind only, never a key

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
  async function buildMe(userId: string, locked: boolean, csrf: string) {
    const u = (await db.query<{ lang: string; birth_year: number; pin_hash: string | null } & Record<string, unknown>>('SELECT id, name, lang, stage, city, discreet, onboarded, created_at, birth_year, pin_hash FROM users WHERE id=$1', [userId]))[0];
    const { birth_year, pin_hash, ...rest } = u;
    // while locked, reveal nothing about her (shared phone): just enough to draw the PIN screen
    if (locked) return { locked: true, hasPin: true, lang: u.lang, discreet: true, onboarded: true, demoMode: env.DEMO_MODE === 'true', csrf };
    return { ...rest, age: now().getFullYear() - birth_year, hasPin: !!pin_hash, locked: false, demoMode: env.DEMO_MODE === 'true', csrf };
  }
  app.get('/api/me', guarded, async (req) => buildMe(req.auth!.userId, req.auth!.locked, req.auth!.csrf));

  /** Same as /api/me but answers 200 {authenticated:false} when nobody is signed in, so anonymous pages (family link, login) log no errors. */
  app.get('/api/session', async (req) => {
    const rows = await findSession(req);
    if (!rows.length) return { authenticated: false };
    return { authenticated: true, me: await buildMe(rows[0].user_id, rows[0].locked, rows[0].csrf) };
  });

  // ---------- Discreet Mode PIN ----------
  const sessionToken = (req: FastifyRequest) => sha(cookies(req)[COOKIE] ?? '');
  const pinRow = async (userId: string) => (await db.query<{ pin_hash: string | null; pin_fails: number; pin_locked_until: string | null }>('SELECT pin_hash, pin_fails, pin_locked_until FROM users WHERE id=$1', [userId]))[0];
  /** Shared by verify/change/remove: wrong PINs count, and 5 misses lock PIN entry for 5 minutes. */
  async function tryPin(userId: string, pin: string): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
    const u = await pinRow(userId);
    if (!u.pin_hash) return { ok: false, status: 400, body: { error: 'no_pin' } };
    if (u.pin_locked_until && new Date(u.pin_locked_until) > now()) return { ok: false, status: 429, body: { error: 'pin_locked', retryAt: new Date(u.pin_locked_until).toISOString() } };
    if (checkPin(pin, u.pin_hash)) { await db.query('UPDATE users SET pin_fails=0, pin_locked_until=NULL WHERE id=$1', [userId]); return { ok: true }; }
    const fails = u.pin_fails + 1;
    if (fails >= MAX_PIN_FAILS) {
      await db.query('UPDATE users SET pin_fails=0, pin_locked_until=$2 WHERE id=$1', [userId, new Date(now().getTime() + PIN_LOCK_MS).toISOString()]);
      await audit(userId, 'system', 'pin_locked_out', 'pin');
      return { ok: false, status: 429, body: { error: 'pin_locked', retryAt: new Date(now().getTime() + PIN_LOCK_MS).toISOString() } };
    }
    await db.query('UPDATE users SET pin_fails=$2 WHERE id=$1', [userId, fails]);
    return { ok: false, status: 401, body: { error: 'wrong_pin', attemptsLeft: MAX_PIN_FAILS - fails } };
  }

  app.post('/api/pin', guarded, async (req, reply) => {
    const b = z.object({ pin: z.string().regex(PIN_RE), currentPin: z.string().regex(PIN_RE).optional() }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if ((await pinRow(userId)).pin_hash) { // changing an existing PIN needs the current one
      const r = await tryPin(userId, b.data.currentPin ?? '');
      if (!r.ok) return reply.code(r.status).send(r.body);
    }
    await db.query('UPDATE users SET pin_hash=$2, pin_fails=0, pin_locked_until=NULL, discreet=TRUE WHERE id=$1', [userId, hashPin(b.data.pin)]);
    await audit(userId, 'user', 'pin_set', 'pin');
    return { ok: true };
  });

  app.delete('/api/pin', guarded, async (req, reply) => {
    const b = z.object({ pin: z.string().regex(PIN_RE) }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const r = await tryPin(req.auth!.userId, b.data.pin);
    if (!r.ok) return reply.code(r.status).send(r.body);
    await db.query('UPDATE users SET pin_hash=NULL, pin_fails=0, pin_locked_until=NULL WHERE id=$1', [req.auth!.userId]);
    await db.query('UPDATE sessions SET locked=FALSE WHERE user_id=$1', [req.auth!.userId]); // no PIN means nothing left to unlock with
    await audit(req.auth!.userId, 'user', 'pin_removed', 'pin');
    return { ok: true };
  });

  app.post('/api/pin/verify', guarded, async (req, reply) => {
    const b = z.object({ pin: z.string().regex(PIN_RE) }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const r = await tryPin(req.auth!.userId, b.data.pin);
    if (!r.ok) return reply.code(r.status).send(r.body);
    await db.query('UPDATE sessions SET locked=FALSE WHERE token_hash=$1', [sessionToken(req)]);
    return { ok: true };
  });

  /** Lock this session now (page reopened, or idle). Only meaningful when a PIN exists. */
  app.post('/api/lock', guarded, async (req, reply) => {
    if (!(await pinRow(req.auth!.userId)).pin_hash) return reply.code(400).send({ error: 'no_pin' });
    await db.query('UPDATE sessions SET locked=TRUE WHERE token_hash=$1', [sessionToken(req)]);
    return { locked: true };
  });

  app.patch('/api/me', guarded, async (req, reply) => {
    const b = z.object({ name: z.string().trim().min(1).max(40), onboarded: z.boolean(), lang: langSchema, stage: z.enum(['perimenopause', 'menopause', 'surgical_early', 'no_family']), city: z.string().trim().min(1).max(60), discreet: z.boolean() }).partial().strict().safeParse(req.body);
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
    if (b.data.purpose === 'doctor_brief' && !b.data.granted) await db.query('UPDATE brief_shares SET revoked_at=$2 WHERE user_id=$1 AND revoked_at IS NULL', [req.auth!.userId, now().toISOString()]);
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

  /**
   * Live chips while she speaks or types. Rules only (no LLM), nothing stored, nothing audited.
   * Red flags still run first, so a crisis phrase is caught the moment it is said.
   */
  app.post('/api/utterance/preview', guarded, async (req, reply) => {
    const b = z.object({ text: z.string().min(1).max(2000), lang: langSchema.optional() }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    if (limited(`prev:${req.auth!.userId}`, 240, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    const lang = b.data.lang ?? ((await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [req.auth!.userId]))[0].lang);
    const r = await handleUtterance(b.data.text, lang, null, env);
    if (r.kind === 'crisis') return r;
    if (r.kind === 'refusal') return { kind: 'refusal', message: r.message };
    return { kind: 'reply', symptoms: r.proposals.map((p) => ({ symptom: p.symptom, severity: p.severity, mrsItem: p.mrsItem, time: p.time, trigger: p.trigger })) };
  });

  /** The fixed Signal Card library with each card's text in every language, so the app can preview exactly what a person will see. */
  app.get('/api/cards', guarded, async () => ({ cards: CARD_TYPES.map((type) => ({ type, text: CARD_TEXT[type] })) }));

  /**
   * "Say it for me": three calm first-person sentences for HER to play aloud or copy, plus the enumerated card that fits.
   * Red flags first. The sentences come from a fixed library; with an LLM key Claude may rephrase them, and anything that
   * fails validation falls back to the library. Nothing here is sent to anyone: sending is a separate tap (POST /api/signals).
   */
  app.post('/api/translate', guarded, async (req, reply) => {
    const b = z.object({ text: z.string().max(2000).optional(), symptoms: z.array(z.enum(SYMPTOMS)).max(16).default([]), card: z.enum(CARD_TYPES).optional(), lang: langSchema.optional() }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if (limited(`tr:${userId}`, 30, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    const lang = b.data.lang ?? ((await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [userId]))[0].lang);
    if (b.data.text) { const hits = detectRedFlags(b.data.text); if (hits.length) return crisisResponse(hits, lang, env); }
    const card = b.data.card ?? suggestCard(b.data.symptoms);
    let tones: Record<Tone, string> = { gentle: SENTENCES[card].gentle[lang], direct: SENTENCES[card].direct[lang], light: SENTENCES[card].light[lang] };
    let source: 'library' | 'llm' = 'library';
    if (llm && b.data.text) {
      try {
        const raw = await llm.complete({
          model: models(env).chat, maxTokens: 400,
          system: `${SYSTEM_PROMPT}
Rewrite the user's feeling as ONE calm first-person sentence in three tones. Language code: ${lang}. Max 25 words each. No blame, no names, no private details, no medical claims. Return ONLY JSON {"gentle":"","direct":"","light":""}. The family will not see this text; she will say or copy it herself.`,
          user: `<user_utterance>${b.data.text}</user_utterance>`,
        });
        const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Record<string, unknown>;
        const out = z.object({ gentle: z.string().min(5).max(220), direct: z.string().min(5).max(220), light: z.string().min(5).max(220) }).strict().parse(j);
        if (TONES.every((t) => !violatesOutputPolicy(out[t]))) { tones = out; source = 'llm'; }
      } catch { /* library fallback */ }
    }
    await audit(userId, 'system', 'translate', `card:${card}`); // metadata only
    return { kind: 'ok', card, tones, source };
  });

  /**
   * Optional natural-voice TTS (ElevenLabs when ELEVENLABS_API_KEY is set). Without a key this answers 501 and the app speaks with
   * the browser voice. Text is the app's own wording (cues, reflections, calm sentences), capped, policy-checked, cached, and never logged.
   */
  const ttsCache = new Map<string, TtsAudio>();
  app.post('/api/tts', guarded, async (req, reply) => {
    if (!tts) return reply.code(501).send({ error: 'tts_not_configured' });
    const b = z.object({ text: z.string().trim().min(1).max(400), lang: langSchema }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if (violatesOutputPolicy(b.data.text)) return reply.code(400).send({ error: 'text_not_allowed' });
    const k = sha(`${b.data.lang}|${b.data.text}`);
    let hit = ttsCache.get(k);
    if (!hit) {
      if (limited(`tts:${userId}`, 40, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
      try { hit = await tts.synth(b.data.text, b.data.lang); } catch { return reply.code(502).send({ error: 'tts_failed' }); }
      if (ttsCache.size >= 300) ttsCache.delete(ttsCache.keys().next().value as string);
      ttsCache.set(k, hit);
    }
    await audit(userId, 'system', 'tts', tts.name); // metadata only, never the text
    return reply.header('content-type', hit.mime).header('cache-control', 'private, max-age=86400').send(hit.audio);
  });

  app.post('/api/logs/confirm', guarded, async (req, reply) => {
    const b = z.object({ setId: z.string().uuid(), decisions: z.array(z.object({ id: z.string(), accept: z.boolean(), severity: z.number().int().min(0).max(4).optional(), time: z.enum(TIMES).optional(), trigger: z.enum(TRIGGERS).optional() }).strict()).max(20) }).strict().safeParse(req.body);
    if (!b.success) return bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await hasConsent(userId, 'core_logging'))) return reply.code(403).send({ error: 'consent_required', purpose: 'core_logging' });
    const proposals = await takeProposals(b.data.setId, userId); // atomic delete-returning: single use
    if (!proposals) return reply.code(404).send({ error: 'proposal_set_not_found' });
    const logs = confirmEntries(proposals, b.data.decisions, now());
    for (const l of logs) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at, time_of_day, trigger) VALUES ($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), userId, l.symptom, l.severity, l.at, l.time ?? 'unspecified', l.trigger ?? 'unspecified']);
    await audit(userId, 'user', 'confirm_logs', `count:${logs.length}`);
    return { saved: logs.length };
  });

  const loadLogs = async (userId: string, days: number): Promise<ConfirmedLog[]> =>
    (await db.query<{ symptom: Symptom; severity: number; at: string; time_of_day: string; trigger: string }>('SELECT symptom, severity, at, time_of_day, trigger FROM logs WHERE user_id=$1 AND at >= $2 ORDER BY at', [userId, new Date(now().getTime() - days * 86400_000).toISOString()]))
      .map((r) => ({ symptom: r.symptom, severity: r.severity, at: new Date(r.at).toISOString(), time: r.time_of_day, trigger: r.trigger }));

  app.get('/api/logs', guarded, async (req) => { await audit(req.auth!.userId, 'user', 'read', 'logs'); return { logs: await loadLogs(req.auth!.userId, 90) }; });

  // ---------- her rights: audit trail, export, deletion ----------
  app.get('/api/audit', guarded, async (req) => ({ entries: await db.query('SELECT actor, action, resource, at FROM audit_log WHERE user_id=$1 ORDER BY id DESC LIMIT 200', [req.auth!.userId]) }));

  app.get('/api/export', guarded, async (req) => {
    const userId = req.auth!.userId;
    await audit(userId, 'user', 'export', 'all');
    const user = (await db.query<{ phone_enc: string } & Record<string, unknown>>('SELECT id, phone_enc, birth_year, lang, stage, city, discreet, created_at FROM users WHERE id=$1', [userId]))[0];
    const { phone_enc, ...profile } = user;
    return {
      exportedAt: now().toISOString(), profile: { ...profile, phone: decrypt(phone_enc, key, `phone:${userId}`) },
      logs: await db.query('SELECT symptom, severity, at, time_of_day, trigger FROM logs WHERE user_id=$1 ORDER BY at', [userId]),
      reminders: (await db.query('SELECT checkin_on, checkin_time, weather_on FROM reminders WHERE user_id=$1', [userId]))[0] ?? null,
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

  const ctx = { db, key, env, now, messenger, weather, audit, guarded, bad, hasConsent, limited };
  registerFamily(app, ctx);
  registerHome(app, ctx);
  registerMoments(app, ctx);
  registerCheckins(app, ctx);
  registerBrief(app, ctx);
  registerLetters(app, ctx);
  registerNight(app, ctx);
  registerReminders(app, { ...ctx, push });
  registerHr(app, ctx);
  registerAdmin(app, ctx);
  registerIvr(app, { ...ctx, phoneHash });

  return app;
}
