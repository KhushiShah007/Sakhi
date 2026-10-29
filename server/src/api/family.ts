import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { LANGS, type Lang } from '../config.js';
import { ALERT_TEXT, CARD_TEXT, CARD_TYPES, LESSONS, type CardType } from '../content/family.js';
import type { Db } from '../db/index.js';
import { decrypt, encrypt } from '../privacy/crypto.js';
import { symptomWeather } from '../safety/weather.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const ROLES = ['husband', 'son', 'daughter', 'teen', 'sister', 'friend', 'asha', 'other'] as const;

/** Sends one card to one person. Keyless fallback = the family link page only (no external call). */
export interface Messenger { name: string; sendCard(a: { phone: string; lang: Lang; text: string; signalId: string; link: string }): Promise<{ status: 'sent' | 'link_only' | 'failed'; messageId?: string }> }

export const linkOnlyMessenger: Messenger = { name: 'family-link', sendCard: async () => ({ status: 'link_only' }) };

/** Meta WhatsApp Cloud API. Needs an approved template with 1 body variable and 2 quick-reply buttons (see SETUP.md). */
export class WhatsAppCloudMessenger implements Messenger {
  name = 'whatsapp-cloud';
  constructor(private cfg: { token: string; phoneId: string; template: string }, private fetchImpl: typeof fetch = fetch) {}
  async sendCard(a: { phone: string; lang: Lang; text: string; signalId: string; link: string }) {
    const res = await this.fetchImpl(`https://graph.facebook.com/v21.0/${this.cfg.phoneId}/messages`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: a.phone.replace(/^\+/, ''), type: 'template',
        template: { name: this.cfg.template, language: { code: a.lang }, components: [
          { type: 'body', parameters: [{ type: 'text', text: a.text }] },
          { type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `done:${a.signalId}` }] },
          { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `help:${a.signalId}` }] },
        ] },
      }),
    }).catch(() => null);
    if (!res?.ok) return { status: 'failed' as const };
    const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[] };
    return { status: 'sent' as const, messageId: j.messages?.[0]?.id };
  }
}

export function messengerFromEnv(env: NodeJS.ProcessEnv = process.env): Messenger {
  return env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID
    ? new WhatsAppCloudMessenger({ token: env.WHATSAPP_TOKEN, phoneId: env.WHATSAPP_PHONE_ID, template: env.WHATSAPP_TEMPLATE_CARD || 'sakhi_signal_card' })
    : linkOnlyMessenger;
}

export interface Ctx {
  db: Db; key: Buffer; env: NodeJS.ProcessEnv; now: () => Date; messenger: Messenger;
  audit: (userId: string, actor: string, action: string, resource: string) => Promise<unknown>;
  guarded: { preHandler: (req: FastifyRequest, reply: FastifyReply) => Promise<unknown> };
  bad: (reply: FastifyReply, e: unknown) => FastifyReply;
  hasConsent: (userId: string, purpose: 'family_signals') => Promise<boolean>;
  limited: (k: string, max: number, windowMs: number) => boolean;
}

interface PersonRow { id: string; user_id: string; her_label: string; lang: Lang; role: string; content_only: boolean; paused: boolean; revoked_at: string | null; perm_signals: boolean; perm_alerts: boolean; perm_coaching: boolean }

export function registerFamily(app: FastifyInstance, c: Ctx) {
  const { db, key, now } = c;
  const baseUrl = c.env.PUBLIC_URL || 'http://localhost:5173';
  const newToken = () => randomBytes(24).toString('base64url');
  const linkFor = (t: string) => `${baseUrl}/#/f/${t}`;
  const iso = () => now().toISOString();
  const day = (offset = 0) => new Date(now().getTime() + offset * 86400_000).toISOString().slice(0, 10);

  /** The ONE function that builds what a family member sees. Her preview uses it too, so "preview" is exact by construction. */
  async function familyView(p: PersonRow) {
    const view: { herLabel: string; lang: Lang; contentOnly: boolean; cards: unknown[]; alert: string | null; lessons: unknown[]; footer: string } = {
      herLabel: p.her_label, lang: p.lang, contentOnly: p.content_only, cards: [], alert: null, lessons: [],
      footer: 'Sakhi is a wellness companion, not a medical service.',
    };
    if (!p.content_only && p.perm_signals) {
      const rows = await db.query<{ id: string; card_type: CardType; sent_at: string; done_at: string | null; needs_help_at: string | null }>(
        'SELECT id, card_type, sent_at, done_at, needs_help_at FROM signals WHERE person_id=$1 ORDER BY sent_at DESC LIMIT 20', [p.id]);
      view.cards = rows.map((r) => ({ id: r.id, type: r.card_type, text: CARD_TEXT[r.card_type]?.[p.lang] ?? '', sentAt: new Date(r.sent_at).toISOString(), status: r.done_at ? 'done' : r.needs_help_at ? 'needs_help' : 'new' }));
    }
    if (!p.content_only && p.perm_alerts) {
      const a = (await db.query<{ level: 'low' | 'moderate' | 'high' }>('SELECT level FROM household_alerts WHERE user_id=$1 AND for_date=$2', [p.user_id, day(1)]))[0];
      if (a) view.alert = ALERT_TEXT[a.level][p.lang];
    }
    const allowed = p.content_only ? LESSONS.filter((l) => l.kind === 'teen_module') : p.perm_coaching ? LESSONS.filter((l) => l.kind !== 'teen_module') : [];
    view.lessons = allowed.map((l) => ({ id: l.id, kind: l.kind, title: l.title[p.lang], points: l.points.map((x) => x[p.lang]), clinicianReviewed: false }));
    return view;
  }

  const loadPerson = async (userId: string, id: string) =>
    (await db.query<PersonRow>('SELECT id, user_id, her_label, lang, role, content_only, paused, revoked_at, perm_signals, perm_alerts, perm_coaching FROM people WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [id, userId]))[0];

  // ---------- her side: people ----------
  app.post('/api/people', c.guarded, async (req, reply) => {
    const b = z.object({ name: z.string().trim().min(1).max(60), herLabel: z.string().trim().min(1).max(40), role: z.enum(ROLES), lang: z.enum(LANGS as [Lang, ...Lang[]]), phone: z.string().regex(/^\+?\d{10,13}$/).optional() }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await c.hasConsent(userId, 'family_signals'))) return reply.code(403).send({ error: 'consent_required', purpose: 'family_signals' });
    const id = randomUUID(); const token = newToken();
    const contentOnly = b.data.role === 'teen'; // under-18s get content only: no signals, no phone, no account
    await db.query('INSERT INTO people(id, user_id, name_enc, her_label, role, lang, phone_enc, link_token_hash, content_only) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, userId, encrypt(b.data.name, key, `person:${id}:name`), b.data.herLabel, b.data.role, b.data.lang, !contentOnly && b.data.phone ? encrypt(b.data.phone, key, `person:${id}:phone`) : null, sha(token), contentOnly]);
    await c.audit(userId, 'user', 'person_added', b.data.role);
    return reply.code(201).send({ id, link: linkFor(token), contentOnly });
  });

  app.get('/api/people', c.guarded, async (req) => {
    const rows = await db.query<PersonRow & { name_enc: string }>('SELECT *, name_enc FROM people WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at', [req.auth!.userId]);
    return { people: rows.map((r) => ({ id: r.id, name: decrypt(r.name_enc, key, `person:${r.id}:name`), role: r.role, lang: r.lang, contentOnly: r.content_only, paused: r.paused, permissions: { signals: r.perm_signals, alerts: r.perm_alerts, coaching: r.perm_coaching } })) };
  });

  app.patch('/api/people/:id', c.guarded, async (req, reply) => {
    const b = z.object({ paused: z.boolean(), perm_signals: z.boolean(), perm_alerts: z.boolean(), perm_coaching: z.boolean() }).partial().strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const p = await loadPerson(req.auth!.userId, (req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: 'not_found' });
    for (const [k, v] of Object.entries(b.data)) await db.query(`UPDATE people SET ${k}=$1 WHERE id=$2`, [v, p.id]); // keys whitelisted by schema
    await c.audit(req.auth!.userId, 'user', 'person_updated', Object.keys(b.data).join(','));
    return { ok: true };
  });

  app.delete('/api/people/:id', c.guarded, async (req, reply) => {
    const p = await loadPerson(req.auth!.userId, (req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: 'not_found' });
    await db.query('UPDATE people SET revoked_at=$1, link_token_hash=$2 WHERE id=$3', [iso(), sha(randomUUID()), p.id]); // old link dies immediately
    await c.audit(req.auth!.userId, 'user', 'person_revoked', p.role);
    return { revoked: true };
  });

  app.post('/api/people/:id/rotate-link', c.guarded, async (req, reply) => {
    const p = await loadPerson(req.auth!.userId, (req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: 'not_found' });
    const t = newToken();
    await db.query('UPDATE people SET link_token_hash=$1 WHERE id=$2', [sha(t), p.id]);
    return { link: linkFor(t) };
  });

  app.get('/api/people/:id/preview', c.guarded, async (req, reply) => {
    const p = await loadPerson(req.auth!.userId, (req.params as { id: string }).id);
    return p ? familyView(p) : reply.code(404).send({ error: 'not_found' });
  });

  // ---------- her side: signals, weather alert, HUI ----------
  app.post('/api/signals', c.guarded, async (req, reply) => {
    const b = z.object({ cardType: z.enum(CARD_TYPES), personIds: z.array(z.string()).max(10).optional() }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    if (!(await c.hasConsent(userId, 'family_signals'))) return reply.code(403).send({ error: 'consent_required', purpose: 'family_signals' });
    const rows = await db.query<PersonRow & { phone_enc: string | null }>('SELECT *, phone_enc FROM people WHERE user_id=$1 AND revoked_at IS NULL AND paused=FALSE AND content_only=FALSE AND perm_signals=TRUE', [userId]);
    const targets = rows.filter((r) => !b.data.personIds || b.data.personIds.includes(r.id));
    const sent: { personId: string; signalId: string; status: string }[] = [];
    for (const p of targets) {
      const signalId = randomUUID();
      // the link token is not recoverable (hashed), so WhatsApp points at the stable page; the person keeps their original link.
      const result = p.phone_enc
        ? await c.messenger.sendCard({ phone: decrypt(p.phone_enc, key, `person:${p.id}:phone`), lang: p.lang, text: CARD_TEXT[b.data.cardType][p.lang], signalId, link: baseUrl })
        : { status: 'link_only' as const, messageId: undefined };
      await db.query('INSERT INTO signals(id, user_id, person_id, card_type, sent_at, delivery_status, wa_message_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [signalId, userId, p.id, b.data.cardType, iso(), result.status, result.messageId ?? null]);
      sent.push({ personId: p.id, signalId, status: result.status });
    }
    await c.audit(userId, 'user', 'signal_sent', `${b.data.cardType}:${sent.length}`);
    return { sent };
  });

  app.post('/api/signals/:id/helped', c.guarded, async (req, reply) => {
    const r = await db.query('UPDATE signals SET helped_at=$1 WHERE id=$2 AND user_id=$3 RETURNING id', [iso(), (req.params as { id: string }).id, req.auth!.userId]);
    return r.length ? { ok: true } : reply.code(404).send({ error: 'not_found' });
  });

  /** HUI: a card is "understood" when the family did the action (done) AND she later said it helped. 0-100, per month. */
  app.get('/api/hui', c.guarded, async (req) => {
    const month = String((req.query as { month?: string }).month ?? day().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(month)) return { month, score: null, cards: 0, understood: 0 };
    const r = (await db.query<{ cards: number; understood: number }>(
      `SELECT count(*)::int AS cards, count(*) FILTER (WHERE done_at IS NOT NULL AND helped_at IS NOT NULL)::int AS understood
       FROM signals WHERE user_id=$1 AND delivery_status <> 'failed' AND to_char(sent_at,'YYYY-MM')=$2`, [req.auth!.userId, month]))[0];
    return { month, cards: r.cards, understood: r.understood, score: r.cards ? Math.round((100 * r.understood) / r.cards) : null, note: 'Target of HUI >= 60 is a pilot hypothesis, not a result.' };
  });

  app.post('/api/symptom-weather', c.guarded, async (req, reply) => {
    const b = z.object({ tempC: z.number().min(-20).max(60).optional(), humidityPct: z.number().min(0).max(100).optional(), aqi: z.number().min(0).max(1000).optional(), share: z.boolean().optional() }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const userId = req.auth!.userId;
    const rows = await db.query<{ symptom: string; d: string; trigger: string }>("SELECT symptom, trigger, to_char(at,'YYYY-MM-DD') AS d FROM logs WHERE user_id=$1 AND at >= $2", [userId, new Date(now().getTime() - 7 * 86400_000).toISOString()]);
    const days = (names: string[]) => new Set(rows.filter((r) => names.includes(r.symptom)).map((r) => r.d)).size;
    const w = symptomWeather({ poorSleepNights: days(['poor_sleep', 'night_waking']), hotFlashDays: days(['hot_flash', 'night_sweats']), stressTriggerDays: new Set(rows.filter((r) => r.trigger === 'stress').map((r) => r.d)).size, windowDays: 7 }, b.data);
    let shared = false;
    if (b.data.share) {
      if (!(await c.hasConsent(userId, 'family_signals'))) return reply.code(403).send({ error: 'consent_required', purpose: 'family_signals' });
      await db.query('INSERT INTO household_alerts(user_id, for_date, level) VALUES ($1,$2,$3) ON CONFLICT (user_id, for_date) DO UPDATE SET level=$3', [userId, day(1), w.level]);
      shared = true; // only the level leaves her account
    }
    await c.audit(userId, 'user', 'read', 'symptom_weather');
    return { ...w, shared };
  });

  // ---------- family side: no account, no cookie, token in the URL ----------
  async function personByToken(token: string): Promise<PersonRow | null> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token) || c.limited(`tok:${sha(token)}`, 60, 60_000)) return null;
    const p = (await db.query<PersonRow>('SELECT id, user_id, her_label, lang, role, content_only, paused, revoked_at, perm_signals, perm_alerts, perm_coaching FROM people WHERE link_token_hash=$1', [sha(token)]))[0];
    return p && !p.revoked_at && !p.paused ? p : null;
  }
  const inactive = (reply: FastifyReply) => reply.code(410).send({ error: 'link_inactive' }); // same answer for unknown, paused and revoked

  app.get('/f/:token', async (req, reply) => {
    const p = await personByToken((req.params as { token: string }).token);
    if (!p) return inactive(reply);
    await c.audit(p.user_id, `person:${p.id}`, 'read', 'family_view');
    return familyView(p);
  });

  async function applyReply(signalId: string, reply: 'done' | 'help') {
    const col = reply === 'done' ? 'done_at' : 'needs_help_at';
    return db.query(`UPDATE signals SET ${col}=COALESCE(${col}, $1) WHERE id=$2 RETURNING id, user_id`, [iso(), signalId]);
  }

  app.post('/f/:token/cards/:id/reply', async (req, reply) => {
    const b = z.object({ reply: z.enum(['done', 'help']) }).strict().safeParse(req.body);
    if (!b.success) return c.bad(reply, b.error);
    const p = await personByToken((req.params as { token: string }).token);
    if (!p) return inactive(reply);
    const sig = (await db.query('SELECT id FROM signals WHERE id=$1 AND person_id=$2', [(req.params as { id: string }).id, p.id]))[0];
    if (!sig) return reply.code(404).send({ error: 'not_found' }); // a person can only answer their own cards
    await applyReply((sig as { id: string }).id, b.data.reply);
    return { ok: true };
  });

  // ---------- WhatsApp Cloud API webhooks (own scope: raw body needed for signature check) ----------
  app.register(async (wa) => {
    wa.removeContentTypeParser('application/json');
    wa.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      try { (req as FastifyRequest & { rawBody?: string }).rawBody = body as string; done(null, JSON.parse(body as string)); } catch (e) { done(e as Error); }
    });

    wa.get('/webhooks/whatsapp', async (req, reply) => {
      const q = req.query as Record<string, string>;
      if (c.env.WHATSAPP_VERIFY_TOKEN && q['hub.mode'] === 'subscribe' && q['hub.verify_token'] === c.env.WHATSAPP_VERIFY_TOKEN) return reply.type('text/plain').send(q['hub.challenge']);
      return reply.code(403).send({ error: 'forbidden' });
    });

    wa.post('/webhooks/whatsapp', async (req, reply) => {
      const secret = c.env.WHATSAPP_APP_SECRET;
      const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? '';
      const sig = String(req.headers['x-hub-signature-256'] ?? '');
      const expected = 'sha256=' + createHmac('sha256', secret ?? '').update(raw).digest('hex');
      if (!secret || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return reply.code(401).send({ error: 'bad_signature' });

      type Value = { statuses?: { id: string; status: string }[]; messages?: { button?: { payload?: string }; interactive?: { button_reply?: { id?: string } } }[] };
      const body = req.body as { entry?: { changes?: { value?: Value }[] }[] };
      const rank = ['link_only', 'sent', 'delivered', 'read'];
      for (const v of (body.entry ?? []).flatMap((e) => (e.changes ?? []).map((x) => x.value ?? {}))) {
        for (const s of v.statuses ?? []) {
          if (s.status === 'failed') await db.query("UPDATE signals SET delivery_status='failed' WHERE wa_message_id=$1", [s.id]);
          else if (rank.includes(s.status)) await db.query(`UPDATE signals SET delivery_status=$1 WHERE wa_message_id=$2 AND delivery_status <> 'failed' AND array_position($3::text[], delivery_status) < array_position($3::text[], $1)`, [s.status, s.id, rank]);
        }
        for (const m of v.messages ?? []) {
          const payload = m.button?.payload ?? m.interactive?.button_reply?.id ?? '';
          const [kind, id] = payload.split(':');
          if ((kind === 'done' || kind === 'help') && id) await applyReply(id, kind);
        }
      }
      return { ok: true };
    });
  });
}
