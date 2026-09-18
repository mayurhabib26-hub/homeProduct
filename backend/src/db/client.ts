/**
 * Database client.
 *
 * Production is Railway Postgres over `postgres.js`. Local development and CI
 * use PGlite — real Postgres compiled to WASM, running in-process with
 * nothing to install. The same generated migrations run on both, so this is a
 * connection-string decision, not an architectural one.
 *
 * PGlite is not a mock: it is the Postgres engine. What it does not give you
 * is concurrency against a shared server, so anything whose correctness
 * depends on lock contention — the stock decrement in Phase 2 — must also be
 * exercised against a real Postgres before it ships. See docs/TESTING.md §3.
 */
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

let db: Database | null = null;

export function getDb(): Database {
  if (db) return db;

  const url = process.env.DATABASE_URL;

  if (url && !url.startsWith('pglite:')) {
    // Pool stays small on purpose: Railway Postgres has no built-in pooler,
    // and a large per-instance pool is how you reach "too many clients
    // already". See docs/DATABASE.md and docs/SCALING.md §2.2.
    const sql = postgres(url, { max: 10 });
    db = drizzlePg(sql, { schema });
  } else {
    const dir = url?.replace('pglite:', '') || './.pglite';
    db = drizzlePglite(new PGlite(dir), { schema });
  }

  return db;
}
