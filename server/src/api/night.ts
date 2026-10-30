import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LANGS, type Lang } from '../config.js';
import { crisisResponse, detectRedFlags } from '../safety/redflags.js';
import type { Ctx } from './family.js';
import { istDay } from './home.js';

/** 3 AM Mode: how long she was awake -> a night_waking severity. A guideline for the log, not a measurement. */
export const awakeSeverity = (minutes: number) => (minutes < 15 ? 1 : minutes < 45 ? 2 : minutes < 90 ? 3 : 4);

export { evaluateRehearsal, type Check, type CheckId } from '../rehearsal/feedback.js';

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

}
