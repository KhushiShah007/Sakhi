import { beforeAll, describe, expect, it } from 'vitest';
import { purgeExpired } from '../src/api/retention.js';
import { migrate, pgliteDb, type Db } from '../src/db/index.js';

let db: Db; const now = new Date('2026-10-29T10:00:00Z');
beforeAll(async () => {
  db = await pgliteDb(); await migrate(db);
  await db.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year) VALUES ('u1','h','e',1978)");
  await db.query("INSERT INTO otps(phone_hash, code_hash, expires_at) VALUES ('a','c','2026-10-29T09:00:00Z'), ('b','c','2026-10-29T11:00:00Z')");
  await db.query("INSERT INTO sessions(token_hash, user_id, csrf, expires_at) VALUES ('t1','u1','c','2026-10-01T00:00:00Z'), ('t2','u1','c','2026-11-30T00:00:00Z')");
  await db.query("INSERT INTO logs(id, user_id, symptom, severity, at, time_of_day, trigger) VALUES ('l1','u1','fatigue',2,'2024-01-01T00:00:00Z','unspecified','unspecified'), ('l2','u1','fatigue',2,'2026-10-01T00:00:00Z','unspecified','unspecified')");
});

describe('retention', () => {
  it('removes only what is expired or older than the window', async () => {
    const p = await purgeExpired(db, now);
    expect(p).toMatchObject({ otps: 1, sessions: 1, oldLogs: 1 });
    expect((await db.query('SELECT 1 FROM otps')).length).toBe(1);
    expect((await db.query('SELECT token_hash FROM sessions')).map((r) => (r as { token_hash: string }).token_hash)).toEqual(['t2']);
    expect((await db.query('SELECT id FROM logs')).map((r) => (r as { id: string }).id)).toEqual(['l2']);
  });
  it('is idempotent, and logMonths 0 keeps logs', async () => {
    expect(await purgeExpired(db, now)).toMatchObject({ otps: 0, sessions: 0, oldLogs: 0 });
    await db.query("INSERT INTO logs(id, user_id, symptom, severity, at, time_of_day, trigger) VALUES ('l3','u1','fatigue',2,'2020-01-01T00:00:00Z','unspecified','unspecified')");
    expect((await purgeExpired(db, now, { logMonths: 0 })).oldLogs).toBe(0);
    expect((await purgeExpired(db, now)).oldLogs).toBe(1);
  });
});
