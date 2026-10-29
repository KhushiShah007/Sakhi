import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/api/app.js';
import { composeBrief } from '../src/api/brief.js';
import type { LogRow } from '../src/api/home.js';
import { LANGS } from '../src/config.js';
import { BAND_NAME, HEAD, MRS_ITEM_NAME, NEXT20_TEXT, QUESTIONS, RULE_OUT_TEXT } from '../src/content/brief.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { renderBriefPdf } from '../src/providers/pdf.js';
import { noWeather } from '../src/providers/weather.js';
import { MRS_ITEMS, subscaleBand } from '../src/safety/mrs.js';
import { ruleOutQuestions } from '../src/safety/ruleout.js';
import { scoreMrs } from '../src/safety/mrs.js';

describe('MRS subscale bands (published cut-offs)', () => {
  it.each([
    ['somatic', [0, 2, 3, 4, 5, 8, 9, 16], ['none', 'none', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe']],
    ['psychological', [0, 1, 2, 3, 4, 6, 7, 16], ['none', 'none', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe']],
    ['urogenital', [0, 1, 2, 3, 4, 12], ['none', 'mild', 'moderate', 'moderate', 'severe', 'severe']],
  ] as const)('%s', (sub, scores, bands) => expect(scores.map((s) => subscaleBand(sub, s))).toEqual(bands));
});

describe('brief content is complete in every language', () => {
  it('has every MRS item, band, rule-out, prevention point and heading in 4 languages', () => {
    for (const l of LANGS) {
      for (const i of MRS_ITEMS) expect(MRS_ITEM_NAME[i][l].length).toBeGreaterThan(3);
      for (const b of Object.values(BAND_NAME)) expect(b[l].length).toBeGreaterThan(1);
      for (const q of QUESTIONS) expect(q[l].length).toBeGreaterThan(10);
      for (const h of Object.values(HEAD)) expect(h[l].length).toBeGreaterThan(1);
      for (const n of Object.values(NEXT20_TEXT)) { expect(n.title[l].length).toBeGreaterThan(3); expect(n.action[l].length).toBeGreaterThan(15); }
    }
  });
  it('every rule-out the engine can emit has translated text, phrased as a question, and says clinician review is pending', () => {
    const all = ruleOutQuestions({ mrs: scoreMrs({ exhaustion: 3, depressive_mood: 3, hot_flushes: 2, sleep: 3, joint_muscle: 2, bladder: 2, heart_discomfort: 1, anxiety: 3 }), weeksOfLogs: 4, bleedingReported: true });
    expect(all.length).toBe(7);
    for (const q of all) { expect(RULE_OUT_TEXT[q.id], q.id).toBeTruthy(); for (const l of LANGS) { expect(RULE_OUT_TEXT[q.id].q[l].length).toBeGreaterThan(10); expect(RULE_OUT_TEXT[q.id].because[l].length).toBeGreaterThan(10); } }
    for (const l of LANGS) expect(HEAD.footer[l].length).toBeGreaterThan(30);
    expect(HEAD.footer.en).toMatch(/not diagnostic/i); expect(HEAD.footer.en).toMatch(/pending clinician review/i);
  });
  it('uses no diagnostic or prescriptive wording', () => {
    const blob = JSON.stringify([RULE_OUT_TEXT, NEXT20_TEXT, QUESTIONS]).toLowerCase();
    expect(blob).not.toMatch(/you have|\bdiagnos(is|ed)\b(?! screen)|\b\d+\s?mg\b|prescrib/);
  });
});

const row = (symptom: string, severity: number, iso: string, extra: Partial<LogRow> = {}): LogRow => ({ symptom: symptom as LogRow['symptom'], severity, at: iso, trigger: 'unspecified', time_of_day: 'unspecified', ...extra });
const days = (n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(29 - i).padStart(2, '0')}T05:00:00Z`);

describe('composeBrief', () => {
  const rows = [
    ...days(10).map((d) => row('hot_flash', 3, d, { time_of_day: 'afternoon', trigger: 'heat' })),
    ...days(6).map((d) => row('poor_sleep', 3, d)), ...days(3).map((d) => row('joint_pain', 2, d)),
    ...days(4).map((d) => row('fatigue', 3, d, { trigger: 'stress' })), row('low_mood', 3, days(1)[0]),
    row('hot_flash', 4, '2026-08-01T05:00:00Z'), // outside the 30-day window: must not count
  ];
  const b = composeBrief({ rows, today: '2026-10-29', name: 'Sunita', age: 48, city: 'Pune', stage: 'perimenopause', lang: 'en', now: new Date('2026-10-29T10:00:00Z') });

  it('scores MRS from the window only (max severity per item)', () => {
    expect(b.mrs.items.hot_flushes).toBe(3); expect(b.mrs.items.sleep).toBe(3); expect(b.mrs.items.joint_muscle).toBe(2); expect(b.mrs.items.exhaustion).toBe(3); expect(b.mrs.items.depressive_mood).toBe(3);
    expect(b.total.score).toBe(14); expect(b.total.band).toBe('moderate'); expect(b.total.max).toBe(44);
    expect(b.subscales.map((s) => [s.id, s.score])).toEqual([['somatic', 8], ['psychological', 6], ['urogenital', 0]]);
    expect(b.items).toHaveLength(11);
  });
  it('builds a 4-week timeline that sums to the logged days', () => {
    expect(b.timeline).toHaveLength(4);
    expect(b.timeline.reduce((a, w) => a + w.hotFlashDays, 0)).toBe(10); expect(b.timeline.reduce((a, w) => a + w.poorSleepDays, 0)).toBe(6);
    expect(b.timeline[3].hotFlashDays).toBeGreaterThan(0);
  });
  it('writes evidence-style highlights from the data', () => {
    expect(b.highlights).toContain('Hot flushes or night sweats on 10 of 30 days, mostly in the afternoon');
    expect(b.highlights).toContain('Poor sleep or waking at night on 6 days'); expect(b.highlights).toContain('Joint or muscle pain on 3 days');
    expect(b.highlights.some((h) => /Most often noted trigger: Stress|Most often noted trigger: Heat/.test(h))).toBe(true);
    expect(b.lowData).toBe(false); expect(b.checkInDays).toBe(10);
  });
  it('suggests rule-outs by rules, phrased as questions, never reviewed', () => {
    expect(b.ruleOut.map((r) => r.id)).toEqual(expect.arrayContaining(['thyroid', 'anaemia', 'depression_screen']));
    for (const r of b.ruleOut) { expect(r.question).toMatch(/^Should we /); expect(r.reviewed).toBe(false); }
    expect(b.clinicianReviewed).toBe(false); expect(b.next20.map((n) => n.id)).toEqual(['bone', 'heart', 'strength', 'screening']);
  });
  it('is honest when there is little data', () => {
    const few = composeBrief({ rows: [row('hot_flash', 2, days(1)[0])], today: '2026-10-29', name: 'A', age: 50, city: null, stage: null, lang: 'en', now: new Date() });
    expect(few.lowData).toBe(true); expect(few.highlights[0]).toMatch(/Only 1 day of check-ins/);
    const none = composeBrief({ rows: [], today: '2026-10-29', name: 'A', age: 50, city: null, stage: null, lang: 'en', now: new Date() });
    expect(none.total.score).toBe(0); expect(none.ruleOut).toEqual([]);
  });
  it('renders in her language with the same numbers', () => {
    for (const l of ['hi', 'mr', 'gu'] as const) {
      const x = composeBrief({ rows, today: '2026-10-29', name: 'Sunita', age: 48, city: 'Pune', stage: 'perimenopause', lang: l, now: new Date() });
      expect(x.total.score).toBe(14); expect(x.items[0].name).toBe(MRS_ITEM_NAME.hot_flushes[l]); expect(x.ruleOut[0].question).toBe(RULE_OUT_TEXT[x.ruleOut[0].id].q[l]);
      expect(x.highlights[0]).toContain('10'); expect(x.headings.footer).toBe(HEAD.footer[l]);
    }
  });
});

/** pdfkit writes standard-font text as hex strings inside TJ/Tj operators; decode them back into readable lines. */
const pdfText = (buf: Buffer) => {
  const s = buf.toString('latin1'); const lines: string[] = [];
  for (const m of s.matchAll(/\[([^\]]*)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
    const parts = m[1] !== undefined ? [...m[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => x[1]) : [m[2]];
    lines.push(parts.map((h) => Buffer.from(h, 'hex').toString('latin1')).join(''));
  }
  return lines.join('\n');
};

describe('PDF', () => {
  const b = composeBrief({ rows: days(12).flatMap((d) => [row('hot_flash', 3, d, { time_of_day: 'night' }), row('fatigue', 3, d), row('poor_sleep', 4, d), row('low_mood', 3, d), row('bladder_urgency', 3, d), row('joint_pain', 3, d)]), today: '2026-10-29', name: 'Sunita Patil', age: 48, city: 'Pune', stage: 'perimenopause', lang: 'en', now: new Date('2026-10-29T10:00:00Z') });
  it('is a valid single-page PDF with the key content (even with every section full)', async () => {
    const pdf = await renderBriefPdf(b, { compress: false });
    const raw = pdf.toString('latin1'); const text = pdfText(pdf);
    expect(raw.startsWith('%PDF-')).toBe(true); expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    expect((raw.match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    for (const needle of ['DOCTOR-READY BRIEF', 'Sunita Patil', 'Menopause Rating Scale', 'Should we check thyroid', 'Supportive, not diagnostic', 'pending clinician review']) expect(text.toLowerCase(), needle).toContain(needle.toLowerCase());
  });
  it('compresses by default and stays small', async () => { expect((await renderBriefPdf(b)).length).toBeLessThan(60_000); });
});

const env = { NODE_ENV: 'test', DEMO_AUTH: 'true', RATE_LIMIT_PER_MIN: '100000', SAKHI_DATA_KEY: Buffer.alloc(32, 6).toString('base64'), PUBLIC_URL: 'https://sakhi.test' } as NodeJS.ProcessEnv;
let db: Db; let app: FastifyInstance; let clock = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); app = await buildApp({ db, llm: null, env, now: () => clock, weather: noWeather }); });
afterAll(async () => { await app.close(); await db.close(); });
interface S { cookie: string; csrf: string }
async function login(phone: string, consent = true): Promise<S> {
  await app.inject({ method: 'POST', url: '/api/auth/otp/request', payload: { phone } });
  const r = await app.inject({ method: 'POST', url: '/api/auth/otp/verify', payload: { phone, code: '123456', birthYear: 1978, lang: 'en' } });
  const s = { cookie: String(r.headers['set-cookie']).split(';')[0], csrf: r.json().csrf };
  await call(s, 'POST', '/api/consents', { purpose: 'core_logging', granted: true });
  if (consent) await call(s, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: true });
  await call(s, 'PATCH', '/api/me', { name: 'Sunita', city: 'Pune', stage: 'perimenopause', onboarded: true });
  return s;
}
const call = (s: S, method: 'GET' | 'POST' | 'DELETE' | 'PATCH', url: string, payload?: unknown) => app.inject({ method, url, payload: payload as object, headers: { cookie: s.cookie, 'x-csrf-token': s.csrf } });
const vent = async (s: S, text: string) => { const u = (await call(s, 'POST', '/api/utterance', { text, lang: 'en' })).json(); await call(s, 'POST', '/api/logs/confirm', { setId: u.setId, decisions: u.proposals.map((p: { id: string }) => ({ id: p.id, accept: true, severity: 3 })) }); };

describe('brief endpoints', () => {
  it('needs doctor_brief consent, and returns an English doctor copy by default', async () => {
    const s = await login('+919600000001', false);
    expect((await call(s, 'GET', '/api/brief')).statusCode).toBe(403);
    expect((await call(s, 'GET', '/api/brief.pdf')).statusCode).toBe(403);
    expect((await call(s, 'POST', '/api/brief/share')).statusCode).toBe(403);
    await call(s, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: true });
    await vent(s, 'hot flashes at night and so tired, stress at work');
    const r = (await call(s, 'GET', '/api/brief')).json();
    expect(r.lang).toBe('en'); expect(r.patient).toMatchObject({ name: 'Sunita', age: 48, city: 'Pune' }); expect(r.total.score).toBeGreaterThan(0);
    expect(r.footer).toMatch(/not diagnostic/i); expect(r.clinicianReviewed).toBe(false);
    const hi = (await call(s, 'GET', '/api/brief?lang=hi')).json();
    expect(hi.lang).toBe('hi'); expect(hi.total.score).toBe(r.total.score); expect(/[ऀ-ॿ]/.test(hi.items[0].name)).toBe(true);
    expect((await call(s, 'GET', '/api/brief?lang=xx')).json().lang).toBe('en');
  });
  it('downloads a PDF and audits it, without her words', async () => {
    const s = await login('+919600000002');
    await vent(s, 'private feelings about my mother in law, hot flashes');
    const r = await call(s, 'GET', '/api/brief.pdf');
    expect(r.statusCode).toBe(200); expect(r.headers['content-type']).toBe('application/pdf'); expect(r.headers['content-disposition']).toContain('attachment');
    expect(r.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    expect(JSON.stringify((await call(s, 'GET', '/api/audit')).json())).toContain('brief_pdf');
  });
  it('a share link serves a frozen PDF to anyone with it, is audited, and can be revoked', async () => {
    const s = await login('+919600000003');
    await vent(s, 'hot flashes today');
    const sh = (await call(s, 'POST', '/api/brief/share')).json();
    expect(sh.link).toMatch(/^https:\/\/sakhi\.test\/b\//);
    const token = sh.link.split('/b/')[1];
    const pub = await app.inject({ method: 'GET', url: `/b/${token}` });
    expect(pub.statusCode).toBe(200); expect(pub.headers['content-type']).toBe('application/pdf'); expect(pub.headers['x-robots-tag']).toBe('noindex'); expect(pub.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
    const trail = JSON.stringify((await call(s, 'GET', '/api/audit')).json());
    expect(trail).toContain('doctor-link'); expect(trail).toContain('brief_shared');
    expect((await call(s, 'GET', '/api/brief/shares')).json().shares[0]).toMatchObject({ id: sh.id, active: true });
    expect((await call(s, 'DELETE', `/api/brief/shares/${sh.id}`)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/b/${token}` })).statusCode).toBe(410);
    expect((await call(s, 'DELETE', `/api/brief/shares/${sh.id}`)).statusCode).toBe(404);
  });
  it('snapshots are frozen, expire after 7 days, and unknown tokens look identical to expired ones', async () => {
    const s = await login('+919600000004');
    await vent(s, 'hot flashes today');
    const token = (await call(s, 'POST', '/api/brief/share')).json().link.split('/b/')[1];
    const unknown = await app.inject({ method: 'GET', url: '/b/' + 'z'.repeat(32) });
    clock = new Date(clock.getTime() + 8 * 86400_000);
    const expired = await app.inject({ method: 'GET', url: `/b/${token}` });
    clock = new Date('2026-10-29T10:00:00Z');
    expect(expired.statusCode).toBe(410); expect(expired.body).toBe(unknown.body);
  });
  it('withdrawing doctor_brief consent kills every doctor link at once', async () => {
    const s = await login('+919600000005');
    await vent(s, 'hot flashes today');
    const token = (await call(s, 'POST', '/api/brief/share')).json().link.split('/b/')[1];
    expect((await app.inject({ method: 'GET', url: `/b/${token}` })).statusCode).toBe(200);
    await call(s, 'POST', '/api/consents', { purpose: 'doctor_brief', granted: false });
    expect((await app.inject({ method: 'GET', url: `/b/${token}` })).statusCode).toBe(410);
  });
  it('shares are private to the owner and gone with the account', async () => {
    const a = await login('+919600000006'); const b = await login('+919600000007');
    const sh = (await call(a, 'POST', '/api/brief/share')).json();
    expect((await call(b, 'DELETE', `/api/brief/shares/${sh.id}`)).statusCode).toBe(404);
    expect((await call(b, 'GET', '/api/brief/shares')).json().shares).toEqual([]);
    await call(a, 'DELETE', '/api/me');
    expect((await app.inject({ method: 'GET', url: `/b/${sh.link.split('/b/')[1]}` })).statusCode).toBe(410);
  });
  it('the stored snapshot is encrypted', async () => {
    const s = await login('+919600000008');
    await vent(s, 'hot flashes today');
    await call(s, 'POST', '/api/brief/share');
    const row = (await db.query<{ data_enc: string }>('SELECT data_enc FROM brief_shares ORDER BY created_at DESC LIMIT 1'))[0];
    expect(row.data_enc.startsWith('v1.')).toBe(true); expect(row.data_enc).not.toContain('Sunita');
  });
});
