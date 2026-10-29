import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Lang } from '../config.js';
import type { Db } from '../db/index.js';
import { decrypt, encrypt } from '../privacy/crypto.js';
import type { PushProvider, PushSub } from '../providers/push.js';
import type { WeatherProvider } from '../providers/weather.js';
import type { Ctx } from './family.js';
import { istDay, weatherFor } from './home.js';

/** Reminders are only ever sent between these India-time hours, whatever she chooses: never at night, never in 3 AM Mode. */
export const SEND_FROM = '08:00';
export const SEND_UNTIL = '21:00';
const CATCH_UP_MIN = 180; // a late server start still sends today's reminder, but not hours after she would want it

/** What shows on a lock screen. Deliberately says nothing about her health. */
export const COPY: Record<'checkin' | 'weather', Record<Lang, { title: string; body: string }>> = {
  checkin: {
    en: { title: 'Sakhi', body: 'A quiet minute for you, whenever you are ready.' },
    hi: { title: 'सखी', body: 'आपके लिए एक शांत पल, जब आप चाहें।' },
    mr: { title: 'सखी', body: 'तुमच्यासाठी एक शांत क्षण, तुम्हाला हवा तेव्हा.' },
    gu: { title: 'સખી', body: 'તમારા માટે એક શાંત પળ, જ્યારે તમે ઇચ્છો.' },
  },
  weather: {
    en: { title: 'Sakhi', body: 'Today may feel a little heavier. Something gentle is waiting for you.' },
    hi: { title: 'सखी', body: 'आज थोड़ा भारी लग सकता है। आपके लिए कुछ कोमल इंतज़ार कर रहा है।' },
    mr: { title: 'सखी', body: 'आज थोडे जड वाटू शकते. तुमच्यासाठी काहीतरी हळुवार वाट पाहत आहे.' },
    gu: { title: 'સખી', body: 'આજે થોડું ભારે લાગી શકે. તમારા માટે કંઈક હળવું રાહ જોઈ રહ્યું છે.' },
  },
};

const hm = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(11, 16);
const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
export const inSendWindow = (now: Date) => hm(now) >= SEND_FROM && hm(now) < SEND_UNTIL;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

interface Row { user_id: string; lang: Lang; checkin_on: boolean; checkin_time: string; weather_on: boolean; last_checkin_day: string | null; last_weather_day: string | null }

/** Sends whatever is due right now. Idempotent per day. Returns how many pushes were delivered. */
export async function sendDueReminders(db: Db, key: Buffer, push: PushProvider | null, weather: WeatherProvider, now: Date): Promise<number> {
  if (!push || !inSendWindow(now)) return 0;
  const today = istDay(now);
  const cur = minutes(hm(now));
  const rows = await db.query<Row>('SELECT r.user_id, u.lang, r.checkin_on, r.checkin_time, r.weather_on, r.last_checkin_day, r.last_weather_day FROM reminders r JOIN users u ON u.id=r.user_id WHERE r.checkin_on OR r.weather_on');
  let sent = 0;
  const deliver = async (userId: string, kind: 'checkin' | 'weather', lang: Lang): Promise<boolean> => {
    const subs = await db.query<{ id: string; sub_enc: string }>('SELECT id, sub_enc FROM push_subscriptions WHERE user_id=$1', [userId]);
    let ok = false;
    for (const s of subs) {
      const sub = JSON.parse(decrypt(s.sub_enc, key, `push:${s.id}`)) as PushSub;
      const r = await push.send(sub, { ...COPY[kind][lang], url: '/' });
      if (r === 'sent') ok = true;
      else if (r === 'gone') await db.query('DELETE FROM push_subscriptions WHERE id=$1', [s.id]);
    }
    return ok;
  };
  for (const r of rows) {
    if (r.checkin_on && r.last_checkin_day !== today && cur >= minutes(r.checkin_time) && cur < minutes(r.checkin_time) + CATCH_UP_MIN) {
      const done = (await db.query('SELECT 1 FROM checkins WHERE user_id=$1 AND day=$2', [r.user_id, today])).length > 0;
      if (!done && (await deliver(r.user_id, 'checkin', r.lang))) sent++;
      await db.query('UPDATE reminders SET last_checkin_day=$2 WHERE user_id=$1', [r.user_id, today]); // done or sent, she is not asked twice today
    }
    if (r.weather_on && r.last_weather_day !== today && cur < minutes('11:00')) {
      const w = await weatherFor(db, r.user_id, now, weather);
      if (w.level === 'high' && (await deliver(r.user_id, 'weather', r.lang))) sent++;
      await db.query('UPDATE reminders SET last_weather_day=$2 WHERE user_id=$1', [r.user_id, today]);
    }
  }
  return sent;
}

export function registerReminders(app: FastifyInstance, c: Ctx & { push: PushProvider | null }) {
  const { db, key } = c;
  app.get('/api/push/config', c.guarded, async () => ({ enabled: !!c.push, publicKey: c.push?.publicKey ?? null }));

  const sub = z.object({ endpoint: z.string().url().max(1000).startsWith('https://'), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
  app.post('/api/push/subscribe', c.guarded, async (req, reply) => {
    if (!c.push) return reply.code(501).send({ error: 'push_not_configured' });
    const b = z.object({ subscription: sub }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    const id = randomUUID();
    await db.query('DELETE FROM push_subscriptions WHERE endpoint_hash=$1', [sha(b.data.subscription.endpoint)]);
    await db.query('INSERT INTO push_subscriptions(id, user_id, endpoint_hash, sub_enc) VALUES ($1,$2,$3,$4)', [id, userId, sha(b.data.subscription.endpoint), encrypt(JSON.stringify(b.data.subscription), key, `push:${id}`)]);
    await c.audit(userId, 'user', 'push_subscribe', 'device');
    return { subscribed: true };
  });
  app.post('/api/push/unsubscribe', c.guarded, async (req, reply) => {
    const b = z.object({ endpoint: z.string().max(1000) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    await db.query('DELETE FROM push_subscriptions WHERE endpoint_hash=$1 AND user_id=$2', [sha(b.data.endpoint), req.auth!.userId]);
    return { subscribed: false };
  });

  const read = async (userId: string) => {
    const r = (await db.query<{ checkin_on: boolean; checkin_time: string; weather_on: boolean }>('SELECT checkin_on, checkin_time, weather_on FROM reminders WHERE user_id=$1', [userId]))[0];
    const devices = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id=$1', [userId]))[0].n;
    return { checkinOn: r?.checkin_on ?? false, checkinTime: r?.checkin_time ?? '09:30', weatherOn: r?.weather_on ?? false, devices, window: { from: SEND_FROM, until: SEND_UNTIL }, available: !!c.push };
  };
  app.get('/api/reminders', c.guarded, async (req) => read(req.auth!.userId));
  app.put('/api/reminders', c.guarded, async (req, reply) => {
    const b = z.object({ checkinOn: z.boolean(), checkinTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).refine((t) => t >= SEND_FROM && t < SEND_UNTIL, 'outside_hours'), weatherOn: z.boolean() }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    await db.query(`INSERT INTO reminders(user_id, checkin_on, checkin_time, weather_on) VALUES ($1,$2,$3,$4)
      ON CONFLICT (user_id) DO UPDATE SET checkin_on=$2, checkin_time=$3, weather_on=$4, updated_at=now()`, [userId, b.data.checkinOn, b.data.checkinTime, b.data.weatherOn]);
    await c.audit(userId, 'user', 'reminders_update', 'reminders');
    return read(userId);
  });
}
