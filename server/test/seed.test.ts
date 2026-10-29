import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildHrSummary } from '../src/api/hr.js';
import { DEMO_PHONE, HR_CODE, seed } from '../src/seed.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';
import { keyFromEnv } from '../src/privacy/crypto.js';
import { createHmac } from 'node:crypto';

const env = { NODE_ENV: 'test', SAKHI_DATA_KEY: Buffer.alloc(32, 4).toString('base64') } as NodeJS.ProcessEnv;
let db: Db; const now = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => { db = await pgliteDb(); await migrate(db); });
afterAll(async () => { await db.close(); });

describe('seed', () => {
  it('creates Sunita, her household, four weeks of logs, a letter, and Navrang with 300+ people (some sites too small to show)', async () => {
    const r = await seed(db, env, now);
    expect(r.sunita).toBe(true); expect(r.hrCode).toBe(HR_CODE);
    const uid = (await db.query<{ id: string }>('SELECT id FROM users WHERE phone_hash=$1', [createHmac('sha256', keyFromEnv(env)).update(DEMO_PHONE).digest('hex')]))[0].id;
    expect((await db.query('SELECT 1 FROM logs WHERE user_id=$1', [uid])).length).toBeGreaterThan(40);
    expect((await db.query('SELECT role FROM people WHERE user_id=$1 ORDER BY created_at', [uid])).map((p: any) => p.role)).toEqual(['husband', 'teen', 'friend']);
    expect((await db.query('SELECT 1 FROM signals WHERE user_id=$1', [uid])).length).toBe(4);
    expect((await db.query('SELECT month FROM letters WHERE user_id=$1 ORDER BY month', [uid])).map((l: any) => l.month)).toEqual(['2026-09', '2026-10']);
    expect((await db.query<{ n: number }>("SELECT count(*)::int AS n FROM employer_members WHERE employer_id='navrang'"))[0].n).toBe(308);
  }, 60_000);
  it('is safe to run twice', async () => {
    const before = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM users'))[0].n;
    const r = await seed(db, env, now);
    expect(r.sunita).toBe(false); expect((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM users'))[0].n).toBe(before);
  }, 60_000);
  it('the HR numbers show the big sites and hide the two small ones, and non-consenting people are never counted', async () => {
    const s = await buildHrSummary(db, 'navrang', now);
    expect(s.suppressed).toBe(false); expect(s.participants!).toBeGreaterThan(250); expect(s.participants!).toBeLessThan(308);
    const by = Object.fromEntries(s.locations.map((l) => [l.name, l]));
    expect(by['Pune HQ'].hidden).toBe(false); expect(by['Mumbai office'].hidden).toBe(false); expect(by['Nashik plant'].hidden).toBe(false);
    expect(by['Ahmedabad branch'].hidden).toBe(true); expect(by['Surat warehouse'].hidden).toBe(true);
    expect(s.locations.find((l) => l.name === 'Surat warehouse')!.participants).toBeNull();
    expect(s.themes.filter((t) => !t.hidden).length).toBeGreaterThanOrEqual(4);
    expect(s.wellbeingIndex).not.toBeNull();
  }, 60_000);
});
