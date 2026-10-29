import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { WhatsAppCloudMessenger, type Messenger } from '../src/api/family.js';
import { CARD_TEXT, CARD_TYPES } from '../src/content/family.js';
import { LANGS } from '../src/config.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', SAKHI_DATA_KEY: Buffer.alloc(32, 5).toString('base64'), RATE_LIMIT_PER_MIN: '100000', WHATSAPP_APP_SECRET: 'shh', WHATSAPP_VERIFY_TOKEN: 'verify-me', PUBLIC_URL: 'https://sakhi.test' } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance;
const sentLog: { phone: string; text: string }[] = [];
const fakeWa: Messenger = { name: 'fake-wa', async sendCard(a) { sentLog.push({ phone: a.phone, text: a.text }); return { status: 'sent', messageId: `wamid.${a.signalId}` }; } };
const clock = new Date('2026-10-29T10:00:00Z');

beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, messenger: fakeWa }); });
afterAll(async () => { await app.close(); await db.close(); });

interface S { cookie: string; csrf: string }
async function login(phone: string): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978 } });
  return { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
}
const call = (s: S, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const tokenOf = (link: string) => link.split('/f/')[1];
async function setup(phone: string, withConsent = true) {
  const s = await login(phone);
  if (withConsent) { await call(s, 'POST', '/api/consents', { purpose: 'family_signals', granted: true }); await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true }); }
  return s;
}
const addRajesh = async (s: S, extra = {}) => (await call(s, 'POST', '/api/people', { name: 'Rajesh', herLabel: 'Sunita', role: 'husband', lang: 'hi', phone: '+919811111111', ...extra })).json();

describe('enumerated cards', () => {
  it('every card exists in all 4 languages, non-empty, short', () => {
    for (const t of CARD_TYPES) for (const l of LANGS) { expect(CARD_TEXT[t][l].length).toBeGreaterThan(10); expect(CARD_TEXT[t][l].length).toBeLessThan(140); }
  });
  it('the signature example card is exact', () => { expect(CARD_TEXT.take_over_dinner.en).toBe("Take over dinner tonight. Don't ask questions."); });
  it('signals reject free text: only enumerated types', async () => {
    const s = await setup('+919100000001'); await addRajesh(s);
    expect((await call(s, 'POST', '/api/signals', { cardType: 'she is furious with you' })).statusCode).toBe(400);
    expect((await call(s, 'POST', '/api/signals', { cardType: 'need_space', text: 'my words' })).statusCode).toBe(400);
  });
});

describe('send -> family link -> reply -> helped -> HUI', () => {
  it('end to end, and the family never sees her words', async () => {
    const s = await setup('+919100000002');
    const p = await addRajesh(s);
    expect(p.link).toMatch(/^https:\/\/sakhi\.test\/#\/f\//);
    await call(s, 'POST', '/api/utterance', { text: 'Rajesh never helps, I am so angry at him', lang: 'en' });
    const sent = (await call(s, 'POST', '/api/signals', { cardType: 'take_over_dinner' })).json().sent;
    expect(sent).toHaveLength(1);
    expect(sentLog.at(-1)!.text).toContain('आज रात का खाना'); // delivered in HIS language
    const t = tokenOf(p.link);
    const view = (await app.inject({ method: 'GET', url: `/f/${t}` })).json();
    expect(view.cards[0]).toMatchObject({ type: 'take_over_dinner', status: 'new' });
    expect(JSON.stringify(view)).not.toMatch(/furious|angry|never helps|vent/i);
    const id = view.cards[0].id;
    expect((await app.inject({ method: 'POST', url: `/f/${t}/cards/${id}/reply`, payload: { reply: 'done' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/f/${t}` })).json().cards[0].status).toBe('done');
    expect((await call(s, 'GET', '/api/hui?month=2026-10')).json().score).toBe(0); // done but not yet "it helped"
    await call(s, 'POST', `/api/signals/${id}/helped`);
    expect((await call(s, 'GET', '/api/hui?month=2026-10')).json()).toMatchObject({ cards: 1, understood: 1, score: 100 });
  });
  it('HUI needs BOTH the action and "it helped"', async () => {
    const s = await setup('+919100000003'); await addRajesh(s);
    const id = (await call(s, 'POST', '/api/signals', { cardType: 'need_space' })).json().sent[0].signalId;
    await call(s, 'POST', `/api/signals/${id}/helped`);
    expect((await call(s, 'GET', '/api/hui?month=2026-10')).json().score).toBe(0);
    expect((await call(s, 'GET', '/api/hui?month=2025-01')).json().score).toBeNull();
  });
  it('a family member can only answer their own card', async () => {
    const a = await setup('+919100000004'); const b = await setup('+919100000005');
    await addRajesh(a); const pb = await addRajesh(b);
    const idA = (await call(a, 'POST', '/api/signals', { cardType: 'rough_night' })).json().sent[0].signalId;
    const r = await app.inject({ method: 'POST', url: `/f/${tokenOf(pb.link)}/cards/${idA}/reply`, payload: { reply: 'done' } });
    expect(r.statusCode).toBe(404);
  });
});

describe('permissions: pause, revoke, per-person, consent', () => {
  it('paused and revoked links go dark with the same answer as an unknown link', async () => {
    const s = await setup('+919100000010'); const p = await addRajesh(s); const t = tokenOf(p.link);
    expect((await app.inject({ method: 'GET', url: `/f/${t}` })).statusCode).toBe(200);
    await call(s, 'PATCH', `/api/people/${p.id}`, { paused: true });
    const paused = await app.inject({ method: 'GET', url: `/f/${t}` });
    const unknown = await app.inject({ method: 'GET', url: '/f/' + 'x'.repeat(32) });
    expect(paused.statusCode).toBe(410); expect(paused.body).toBe(unknown.body);
    await call(s, 'PATCH', `/api/people/${p.id}`, { paused: false });
    expect((await app.inject({ method: 'GET', url: `/f/${t}` })).statusCode).toBe(200);
    await call(s, 'DELETE', `/api/people/${p.id}`);
    expect((await app.inject({ method: 'GET', url: `/f/${t}` })).statusCode).toBe(410);
    expect((await call(s, 'GET', '/api/people')).json().people).toHaveLength(0);
  });
  it('people without the signals permission receive no new cards', async () => {
    const s = await setup('+919100000011'); const p = await addRajesh(s);
    await call(s, 'PATCH', `/api/people/${p.id}`, { perm_signals: false });
    expect((await call(s, 'POST', '/api/signals', { cardType: 'need_space' })).json().sent).toHaveLength(0);
  });
  it('rotating the link kills the old one', async () => {
    const s = await setup('+919100000012'); const p = await addRajesh(s);
    const n = (await call(s, 'POST', `/api/people/${p.id}/rotate-link`)).json();
    expect((await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` })).statusCode).toBe(410);
    expect((await app.inject({ method: 'GET', url: `/f/${tokenOf(n.link)}` })).statusCode).toBe(200);
  });
  it('sharing requires family_signals consent; withdrawing stops sends', async () => {
    const s = await setup('+919100000013', false);
    expect((await call(s, 'POST', '/api/people', { name: 'R', herLabel: 'S', role: 'husband', lang: 'en' })).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'family_signals', granted: true }); await addRajesh(s);
    await call(s, 'POST', '/api/consents', { purpose: 'family_signals', granted: false });
    expect((await call(s, 'POST', '/api/signals', { cardType: 'need_space' })).statusCode).toBe(403);
  });
  it('preview shows exactly what the family sees', async () => {
    const s = await setup('+919100000014'); const p = await addRajesh(s);
    await call(s, 'POST', '/api/signals', { cardType: 'just_sit_with_me' });
    const preview = (await call(s, 'GET', `/api/people/${p.id}/preview`)).json();
    const real = (await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` })).json();
    expect(preview).toEqual(real);
  });
  it("one user cannot see or change another user's people", async () => {
    const a = await setup('+919100000015'); const b = await setup('+919100000016');
    const p = await addRajesh(a);
    expect((await call(b, 'GET', `/api/people/${p.id}/preview`)).statusCode).toBe(404);
    expect((await call(b, 'PATCH', `/api/people/${p.id}`, { paused: true })).statusCode).toBe(404);
    expect((await call(b, 'DELETE', `/api/people/${p.id}`)).statusCode).toBe(404);
  });
  it('family access is in her audit trail', async () => {
    const s = await setup('+919100000017'); const p = await addRajesh(s);
    await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` });
    const a = (await call(s, 'GET', '/api/audit')).json().entries;
    expect(a.some((e: { resource: string; actor: string }) => e.resource === 'family_view' && e.actor.startsWith('person:'))).toBe(true);
  });
});

describe('teen content-only and trusted person', () => {
  it('teen gets lessons only: no cards, no alerts, no phone stored, never targeted by signals', async () => {
    const s = await setup('+919100000020');
    const t = await addRajesh(s, { name: 'Anaya', role: 'teen', lang: 'en', phone: '+919822222222' });
    expect(t.contentOnly).toBe(true);
    await call(s, 'POST', '/api/signals', { cardType: 'need_space' });
    const v = (await app.inject({ method: 'GET', url: `/f/${tokenOf(t.link)}` })).json();
    expect(v.cards).toEqual([]); expect(v.alert).toBeNull();
    expect(v.lessons.map((l: { kind: string }) => l.kind)).toEqual(['teen_module']);
    expect((await db.query<{ phone_enc: string | null }>('SELECT phone_enc FROM people WHERE id=$1', [t.id]))[0].phone_enc).toBeNull();
    expect(await db.query('SELECT 1 FROM signals WHERE person_id=$1', [t.id])).toHaveLength(0);
  });
  it('trusted person (ASHA/sister/friend) uses the same signal system', async () => {
    const s = await setup('+919100000021');
    for (const role of ['asha', 'sister', 'friend']) { const p = await addRajesh(s, { name: role, role, lang: 'mr' }); expect(p.id).toBeTruthy(); }
    expect((await call(s, 'POST', '/api/signals', { cardType: 'overwhelmed' })).json().sent).toHaveLength(3);
  });
});

describe('weather alert to household', () => {
  it('shares only the level, in the family language, and labels it an estimate', async () => {
    const s = await setup('+919100000030'); const p = await addRajesh(s);
    for (let i = 0; i < 3; i++) {
      const u = (await call(s, 'POST', '/api/utterance', { text: 'hot flashes and cannot sleep', lang: 'en' })).json();
      await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((x: { id: string }) => ({ id: x.id, accept: true, severity: 3 })) });
    }
    const w = (await call(s, 'POST', '/api/symptom-weather', { tempC: 40, humidityPct: 80, share: true })).json();
    expect(w.estimate).toBe(true); expect(w.shared).toBe(true);
    const v = (await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` })).json();
    expect(v.alert).toMatch(/कल:/);
    expect(JSON.stringify(v)).not.toMatch(/humidity|sleep/i);
    await call(s, 'PATCH', `/api/people/${p.id}`, { perm_alerts: false });
    expect((await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` })).json().alert).toBeNull();
  });
});

describe('WhatsApp webhooks', () => {
  const sign = (body: string, secret = 'shh') => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const post = (payload: object, secret?: string) => { const body = JSON.stringify(payload); return app.inject({ method: 'POST', url: '/webhooks/whatsapp', payload: body, headers: { 'content-type': 'application/json', 'x-hub-signature-256': sign(body, secret) } }); };
  const wrap = (value: object) => ({ entry: [{ changes: [{ value }] }] });

  it('verifies the subscription handshake', async () => {
    expect((await app.inject({ method: 'GET', url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1234' })).body).toBe('1234');
    expect((await app.inject({ method: 'GET', url: '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1' })).statusCode).toBe(403);
  });
  it('rejects unsigned or wrongly signed callbacks', async () => {
    expect((await post(wrap({}), 'wrong')).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/webhooks/whatsapp', payload: '{}', headers: { 'content-type': 'application/json' } })).statusCode).toBe(401);
  });
  it('tracks delivery status forward only, and handles quick replies', async () => {
    const s = await setup('+919100000040'); await addRajesh(s);
    const id = (await call(s, 'POST', '/api/signals', { cardType: 'need_space' })).json().sent[0].signalId;
    const status = async () => (await db.query<{ delivery_status: string }>('SELECT delivery_status FROM signals WHERE id=$1', [id]))[0].delivery_status;
    await post(wrap({ statuses: [{ id: `wamid.${id}`, status: 'read' }] })); expect(await status()).toBe('read');
    await post(wrap({ statuses: [{ id: `wamid.${id}`, status: 'delivered' }] })); expect(await status()).toBe('read'); // never regresses
    await post(wrap({ messages: [{ button: { payload: `done:${id}` } }] }));
    expect((await db.query<{ done_at: string | null }>('SELECT done_at FROM signals WHERE id=$1', [id]))[0].done_at).not.toBeNull();
    await post(wrap({ messages: [{ interactive: { button_reply: { id: `help:${id}` } } }] }));
    expect((await db.query<{ needs_help_at: string | null }>('SELECT needs_help_at FROM signals WHERE id=$1', [id]))[0].needs_help_at).not.toBeNull();
    await post(wrap({ statuses: [{ id: `wamid.${id}`, status: 'failed' }] })); expect(await status()).toBe('failed');
  });
  it('the Cloud API sender builds the template call with quick-reply payloads, and reports failure', async () => {
    let captured: { url: string; body: any; auth: string } | null = null;
    const okFetch = (async (url: string, init: any) => { captured = { url, body: JSON.parse(init.body), auth: init.headers.authorization }; return { ok: true, json: async () => ({ messages: [{ id: 'wamid.X' }] }) }; }) as unknown as typeof fetch;
    const m = new WhatsAppCloudMessenger({ token: 'tok', phoneId: '123', template: 'sakhi_signal_card' }, okFetch);
    expect(await m.sendCard({ phone: '+919811111111', lang: 'hi', text: 'hello', signalId: 'S1', link: 'x' })).toEqual({ status: 'sent', messageId: 'wamid.X' });
    expect(captured!.url).toContain('/123/messages'); expect(captured!.auth).toBe('Bearer tok'); expect(captured!.body.to).toBe('919811111111');
    expect(JSON.stringify(captured!.body)).toContain('done:S1'); expect(JSON.stringify(captured!.body)).toContain('help:S1');
    const failing = new WhatsAppCloudMessenger({ token: 't', phoneId: '1', template: 't' }, (async () => ({ ok: false })) as unknown as typeof fetch);
    expect((await failing.sendCard({ phone: '+91981', lang: 'en', text: 't', signalId: 's', link: '' })).status).toBe('failed');
  });
});

describe('deletion removes the household too', () => {
  it('account deletion revokes every family link', async () => {
    const s = await setup('+919100000050'); const p = await addRajesh(s);
    await call(s, 'POST', '/api/signals', { cardType: 'need_space' });
    await call(s, 'DELETE', '/api/me');
    expect((await app.inject({ method: 'GET', url: `/f/${tokenOf(p.link)}` })).statusCode).toBe(410);
    expect(await db.query('SELECT 1 FROM people WHERE id=$1', [p.id])).toHaveLength(0);
    expect(await db.query('SELECT 1 FROM signals WHERE person_id=$1', [p.id])).toHaveLength(0);
  });
});
