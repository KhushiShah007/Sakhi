import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGS, type Lang } from '../config.js';
import { crisisResponse, detectRedFlags } from '../safety/redflags.js';
import type { Ctx } from './family.js';
import { istDay } from './home.js';

/** 3 AM Mode: how long she was awake -> a night_waking severity. A guideline for the log, not a measurement. */
export const awakeSeverity = (minutes: number) => (minutes < 15 ? 1 : minutes < 45 ? 2 : minutes < 90 ? 3 : 4);

export type CheckId = 'i_statement' | 'ask' | 'no_blame' | 'calm';
const P: Record<CheckId, Record<Lang, RegExp>> = {
  i_statement: {
    en: /\bI (feel|felt|am|have been|need|can ?not|can't|want|would like)\b|\bI'm\b|\bmy (sleep|body|days?)\b/i,
    hi: /मुझे|मैं|मेरा|मेरी|मेरे/, mr: /मला|मी |माझे|माझी|माझा/, gu: /મને|હું|મારું|મારી|મારો|મારા/,
  },
  ask: {
    en: /\b(could|can|would|will) you\b|\bplease\b|\bI need (you|us|some)\b|\bwhat if\b|\b(every|each|by|before|after|on) (day|week|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)/i,
    hi: /कृपया|क्या आप|क्या तुम|सकते हैं|सकती हो|चाहिए|चाहती हूँ|मदद|हर (दिन|हफ़्ते|हफ्ते|सुबह|शाम)/, mr: /कृपया|तुम्ही.*शकता|तू.*शकतोस|शकाल का|हवे|पाहिजे|मदत|दर (दिवशी|आठवड्याला)/, gu: /કૃપા|તમે.*શકો|તું.*શકે|જોઈએ|મદદ|દર (દિવસે|અઠવાડિયે)/,
  },
  no_blame: {
    en: /\b(always|never|you don'?t care|you never|your fault|because of you|you should have)\b/i,
    hi: /हमेशा|कभी नहीं|तुम्हारी वजह|आपकी वजह|परवाह नहीं|तुम्हारी गलती|आपकी गलती/, mr: /नेहमी|कधीच नाही|तुझ्यामुळे|तुमच्यामुळे|काळजी नाही|तुझी चूक|तुमची चूक/, gu: /હંમેશા|ક્યારેય નહીં|તમારા કારણે|તારા કારણે|પરવા નથી|તમારી ભૂલ|તારી ભૂલ/,
  },
  calm: { en: /[A-Z]{5,}|[!?]{2,}/, hi: /[!?]{2,}/, mr: /[!?]{2,}/, gu: /[!?]{2,}/ },
};

export interface Check { id: CheckId; pass: boolean }
/** Pure, rule-based feedback on HER OWN lines in a rehearsal. It judges phrasing (I-statement, a clear ask, no blame, calm), never her feelings. */
export function evaluateRehearsal(lines: string[], lang: Lang): { checks: Check[]; tip: CheckId | 'great' } {
  const text = lines.join(' \n ');
  const norm = text.normalize('NFC');
  const checks: Check[] = [
    { id: 'i_statement', pass: P.i_statement[lang].test(norm) },
    { id: 'ask', pass: P.ask[lang].test(norm) },
    { id: 'no_blame', pass: !P.no_blame[lang].test(norm) },
    { id: 'calm', pass: !P.calm[lang].test(text) },
  ];
  const firstFail = checks.find((c) => !c.pass);
  return { checks, tip: firstFail ? firstFail.id : 'great' };
}

export function registerNight(app: FastifyInstance, c: Ctx) {
  const { db, now } = c;

  /** She taps "save" after a night awake; that tap is her confirmation, like every other log entry. */
  app.post('/api/awakenings', c.guarded, async (req, reply) => {
    const b = z.object({ minutes: z.number().int().min(1).max(600) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await c.hasConsent(userId, 'core_logging' as never))) return reply.code(403).send({ error: 'consent_required', purpose: 'core_logging' });
    const severity = awakeSeverity(b.data.minutes);
    await db.query("INSERT INTO logs(id, user_id, symptom, severity, at, time_of_day, trigger) VALUES ($1,$2,'night_waking',$3,$4,'night','unspecified')", [randomUUID(), userId, severity, now().toISOString()]);
    await c.audit(userId, 'user', 'confirm_logs', 'awakening');
    return { saved: true, severity, day: istDay(now()) };
  });

  const scenario = z.enum(['family', 'hr', 'doctor']);
  app.post('/api/rehearsal/feedback', c.guarded, async (req, reply) => {
    const b = z.object({ scenario, lines: z.array(z.string().trim().min(1).max(300)).min(1).max(6), lang: z.enum(LANGS as [Lang, ...Lang[]]) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    if (c.limited(`reh:${req.auth!.userId}`, 60, 60_000)) return reply.code(429).send({ error: 'rate_limited' });
    // red flags first, even in role-play: a real crisis is never treated as practice
    const hits = detectRedFlags(b.data.lines.join(' '));
    if (hits.length) return crisisResponse(hits, b.data.lang, c.env);
    return { kind: 'feedback', scenario: b.data.scenario, ...evaluateRehearsal(b.data.lines, b.data.lang) }; // nothing stored: practice is private
  });
}
