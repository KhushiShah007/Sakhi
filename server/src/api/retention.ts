import type { Db } from '../db/index.js';

export interface Purged { otps: number; sessions: number; proposals: number; shares: number; adminSessions: number; oldLogs: number }

/**
 * Scheduled deletion, so data does not sit around longer than it is useful. Idempotent and safe to run often.
 * - expired one-time codes, sessions, admin sessions and unconfirmed proposal sets: immediately
 * - doctor/letter share links: 30 days after they expired (kept briefly so a revoked/expired link answers "expired", not "unknown")
 * - confirmed logs older than `logMonths` (default 24; 0 turns it off). She can still delete or export at any time.
 * The audit trail is kept: it holds no content, only who/what/when.
 */
export async function purgeExpired(db: Db, now: Date, opts: { logMonths?: number } = {}): Promise<Purged> {
  const iso = now.toISOString();
  const grace = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const del = async (sql: string, args: unknown[]) => (await db.query<{ n: number }>(`WITH d AS (${sql} RETURNING 1) SELECT count(*)::int AS n FROM d`, args))[0].n;
  const months = opts.logMonths ?? 24;
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return {
    otps: await del('DELETE FROM otps WHERE expires_at < $1', [iso]),
    sessions: await del('DELETE FROM sessions WHERE expires_at < $1', [iso]),
    proposals: await del('DELETE FROM proposal_sets WHERE expires_at < $1', [iso]),
    shares: (await del('DELETE FROM brief_shares WHERE expires_at < $1', [grace])) + (await del('DELETE FROM letter_shares WHERE expires_at < $1', [grace])),
    adminSessions: await del('DELETE FROM admin_sessions WHERE expires_at < $1', [iso]),
    oldLogs: months > 0 ? await del('DELETE FROM logs WHERE at < $1', [cutoff.toISOString()]) : 0,
  };
}
