import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** Real Postgres (production, docker-compose). */
export async function pgDb(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  return {
    query: async (sql, params) => (await pool.query(sql, params as unknown[])).rows,
    exec: async (sql) => { await pool.query(sql); },
    close: () => pool.end(),
  };
}

/** Embedded Postgres (WASM). Same dialect; used for zero-install dev and tests. dataDir omitted = in-memory. */
export async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) mkdirSync(dirname(dataDir), { recursive: true }); // PGlite will not create parent folders
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.waitReady;
  return {
    query: async <T,>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows,
    exec: async (sql) => { await db.exec(sql); },
    close: () => db.close(),
  };
}

export async function dbFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<Db> {
  if (env.DATABASE_URL) return pgDb(env.DATABASE_URL);
  if (env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production');
  // dev default persists to disk so data survives restarts (set PGLITE_DIR=memory for a throwaway database)
  const dir = env.PGLITE_DIR === 'memory' ? undefined : env.PGLITE_DIR || '.data/pglite';
  return pgliteDb(dir);
}

export async function migrate(db: Db): Promise<string[]> {
  await db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM _migrations')).map((r) => r.name));
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await db.exec(readFileSync(join(dir, f), 'utf8'));
    await db.query('INSERT INTO _migrations(name) VALUES ($1)', [f]);
    applied.push(f);
  }
  return applied;
}
