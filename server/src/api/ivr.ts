import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Lang } from '../config.js';
import { fill } from '../content/brief.js';
import { IVR } from '../content/ivr.js';
import { SYMPTOM_NAME } from '../content/letter.js';
import { handleUtterance } from '../safety/pipeline.js';
import type { Ctx } from './family.js';

/** One thing the line says. `pauseMs` is silence after it (breathing room). */
export interface Say { text: string; pauseMs: number }
export interface IvrResponse { say: Say[]; gather?: { input: 'speech'; lang: Lang; action: string }; hangup?: boolean }
const SPEECH: Record<Lang, string> = { hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', en: 'en-IN' };

/** The Right Now exercise as it is heard on a basic phone: three slow breaths, then she is invited to speak. */
export function rightNowScript(lang: Lang): Say[] {
  const breath = [{ text: IVR.in[lang], pauseMs: 4000 }, { text: IVR.hold[lang], pauseMs: 2000 }, { text: IVR.out[lang], pauseMs: 6000 }];
  return [{ text: IVR.intro[lang], pauseMs: 1500 }, { text: IVR.shoulders[lang], pauseMs: 2500 }, ...breath, ...breath, ...breath];
}

/** The same pipeline as the app: red flags first, then policy, then extraction. Nothing is stored (no way to confirm by phone), and nothing is logged. */
export async function ivrSpeech(transcript: string, lang: Lang, c: Pick<Ctx, 'env'>): Promise<IvrResponse> {
  const r = await handleUtterance(transcript, lang, null, c.env);
  if (r.kind === 'crisis') {
    const nums = r.helplines.map((h) => `${h.name} ${h.number.split('').join(' ')}`).join(', ');
    return { say: [{ text: r.message, pauseMs: 1500 }, { text: fill(IVR.call[lang], { numbers: nums }), pauseMs: 1000 }], hangup: true };
  }
  if (r.kind === 'refusal') return { say: [{ text: r.message, pauseMs: 1000 }, { text: IVR.bye[lang], pauseMs: 0 }], hangup: true };
  const names = [...new Set(r.proposals.map((p) => SYMPTOM_NAME[p.symptom][lang]))];
  return { say: [{ text: names.length ? fill(IVR.heard[lang], { list: names.join(', ') }) : IVR.nothing[lang], pauseMs: 800 }, { text: r.message, pauseMs: 800 }, { text: IVR.notSaved[lang], pauseMs: 800 }, { text: IVR.bye[lang], pauseMs: 0 }], hangup: true };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
/** Twilio/Exotel-style call-flow XML for the same response. */
export function toTwiml(r: IvrResponse, lang: Lang): string {
  const body = r.say.map((s) => `<Say language="${SPEECH[lang]}">${esc(s.text)}</Say>${s.pauseMs ? `<Pause length="${Math.ceil(s.pauseMs / 1000)}"/>` : ''}`).join('');
  const gather = r.gather ? `<Gather input="speech" language="${SPEECH[r.gather.lang]}" action="${esc(r.gather.action)}" method="POST" speechTimeout="auto"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}${gather}${r.hangup ? '<Hangup/>' : ''}</Response>`;
}

export function registerIvr(app: FastifyInstance, c: Ctx & { phoneHash: (phone: string) => string }) {
  const { db, key } = c;
  const secret = c.env.IVR_WEBHOOK_SECRET;
  const sign = (userId: string, lang: Lang, exp: number) => { const p = `${userId}.${lang}.${exp}`; return `${Buffer.from(p).toString('base64url')}.${createHmac('sha256', key).update(p).digest('base64url')}`; };
  /** A call session proves which woman a later webhook is about, so a caller cannot post speech "as" someone else. */
  const verify = (tok: string): { userId: string; lang: Lang } | null => {
    const [b, mac] = tok.split('.'); if (!b || !mac) return null;
    const p = Buffer.from(b, 'base64url').toString(); const want = createHmac('sha256', key).update(p).digest('base64url');
    if (want.length !== mac.length || !timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
    const [userId, lang, exp] = p.split('.');
    return Number(exp) > c.now().getTime() && ['hi', 'mr', 'gu', 'en'].includes(lang) ? { userId, lang: lang as Lang } : null;
  };
  const reply = (req: FastifyRequest, reply: FastifyReply, r: IvrResponse, lang: Lang) =>
    ((req.query as { format?: string }).format === 'twiml' || String(req.headers.accept ?? '').includes('xml'))
      ? reply.header('content-type', 'text/xml; charset=utf-8').send(toTwiml(r, lang)) : r;

  /** Starts a call for a known number. Only the telephony provider (shared secret) can ask; an unknown number simply gets no callback. */
  async function begin(userId: string | undefined, lang: Lang, base: string): Promise<IvrResponse & { session?: string }> {
    if (!userId) return { say: [], hangup: true };
    const session = sign(userId, lang, c.now().getTime() + 15 * 60_000);
    return { session, say: [...rightNowScript(lang), { text: IVR.prompt[lang], pauseMs: 0 }], gather: { input: 'speech', lang, action: `${base}/webhooks/ivr/speech?session=${encodeURIComponent(session)}` } };
  }
  const authed = (req: FastifyRequest, reply: FastifyReply) => {
    if (!secret) { reply.code(503).send({ error: 'ivr_not_configured', hint: 'Set IVR_WEBHOOK_SECRET to accept a telephony provider; the in-app simulator needs no secret' }); return false; }
    const got = String(req.headers['x-ivr-secret'] ?? '');
    if (got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) { reply.code(401).send({ error: 'unauthorised' }); return false; }
    return true;
  };
  const baseOf = (req: FastifyRequest) => (c.env.PUBLIC_URL ? c.env.PUBLIC_URL.replace(/\/$/, '') : `${String(req.headers['x-forwarded-proto'] ?? req.protocol).split(',')[0]}://${req.headers.host}`);

  // ---- telephony provider webhooks (shared secret)
  app.post('/webhooks/ivr/missed-call', async (req, rep) => {
    if (!authed(req, rep)) return;
    const b = z.object({ from: z.string().regex(/^\+?\d{10,13}$/) }).passthrough().safeParse(req.body);
    if (!b.success) return c.bad(rep, b.error);
    if (c.limited(`ivr:${b.data.from}`, 5, 10 * 60_000)) return rep.code(429).send({ error: 'rate_limited' });
    const u = (await db.query<{ id: string; lang: Lang }>('SELECT id, lang FROM users WHERE phone_hash=$1', [c.phoneHash(b.data.from)]))[0];
    if (u) await c.audit(u.id, 'system', 'ivr_missed_call', 'callback');
    // the provider calls her back and requests /webhooks/ivr/answer?session=... once she picks up
    const r = u ? await begin(u.id, u.lang, baseOf(req)) : { say: [], hangup: true };
    return { callback: !!u, answerUrl: u ? `${baseOf(req)}/webhooks/ivr/answer?session=${encodeURIComponent((r as { session?: string }).session!)}` : null };
  });
  app.all('/webhooks/ivr/answer', async (req, rep) => {
    if (!authed(req, rep)) return;
    const s = verify(String((req.query as { session?: string }).session ?? ''));
    if (!s) return rep.code(401).send({ error: 'bad_session' });
    return reply(req, rep, await begin(s.userId, s.lang, baseOf(req)), s.lang);
  });
  app.post('/webhooks/ivr/speech', async (req, rep) => {
    if (!authed(req, rep)) return;
    const s = verify(String((req.query as { session?: string }).session ?? ''));
    if (!s) return rep.code(401).send({ error: 'bad_session' });
    const b = z.object({ SpeechResult: z.string().max(2000).optional(), transcript: z.string().max(2000).optional() }).passthrough().safeParse(req.body);
    const text = (b.success && (b.data.SpeechResult ?? b.data.transcript)) || '';
    if (!text.trim()) return reply(req, rep, { say: [{ text: IVR.nothing[s.lang], pauseMs: 500 }, { text: IVR.bye[s.lang], pauseMs: 0 }], hangup: true }, s.lang);
    return reply(req, rep, await ivrSpeech(text, s.lang, c), s.lang);
  });

  // ---- in-app simulator: same handlers, her own session instead of a provider secret
  app.post('/api/ivr/simulate/missed-call', c.guarded, async (req) => {
    const u = (await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [req.auth!.userId]))[0];
    await c.audit(req.auth!.userId, 'user', 'ivr_simulated', 'callback');
    return begin(req.auth!.userId, u.lang, '');
  });
  app.post('/api/ivr/simulate/speech', c.guarded, async (req, rep) => {
    const b = z.object({ transcript: z.string().max(2000) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(rep, b.error);
    const u = (await db.query<{ lang: Lang }>('SELECT lang FROM users WHERE id=$1', [req.auth!.userId]))[0];
    return ivrSpeech(b.data.transcript, u.lang, c);
  });
}
