/**
 * The most valuable test in the suite: prove we cannot oversell.
 *
 *   Given a variant with N in stock
 *   When many orders for it arrive at once
 *   Then exactly N units are sold, never N+1
 *
 * Run: npm run test:concurrency -w backend   (stop the API first)
 *
 * ---------------------------------------------------------------------------
 * READ THIS BEFORE TRUSTING A PASS.
 *
 * Against PGlite this runs in one process against one connection, so requests
 * interleave but never genuinely contend for a row lock. It proves the guard's
 * arithmetic; it does NOT prove behaviour under contention, and it cannot
 * surface a deadlock from inconsistent lock ordering.
 *
 * Before Phase 2 ships, run this against a real Postgres:
 *
 *   docker compose up -d
 *   DATABASE_URL=postgres://sv:sv@localhost:5432/sv_dev npm run db:migrate -w backend
 *   DATABASE_URL=postgres://sv:sv@localhost:5432/sv_dev npm run db:seed -w backend
 *   DATABASE_URL=postgres://sv:sv@localhost:5432/sv_dev npm run test:concurrency -w backend
 *
 * If it ever reports more sold than existed, stop everything else and fix it.
 * See docs/TESTING.md §3.
 * ---------------------------------------------------------------------------
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { decrementStock, InsufficientStockError } from './stock.js';

const db = getDb();
const VARIANT = await testVariantId();
const STOCK = 50;
const ATTEMPTS = 200;

const stockOf = async (): Promise<number> => {
  const r = (await db.execute(sql`select stock_qty from variants where id = ${VARIANT}`)) as unknown as
    | { rows?: Array<{ stock_qty: number }> } | Array<{ stock_qty: number }>;
  const rows = Array.isArray(r) ? r : (r.rows ?? []);
  return Number(rows[0]!.stock_qty);
};

await db.execute(sql`update variants set stock_qty = ${STOCK} where id = ${VARIANT}`);

const results = await Promise.allSettled(
  Array.from({ length: ATTEMPTS }, () =>
    db.transaction(async (tx) => {
      await decrementStock(tx as unknown as typeof db, [{ variantId: VARIANT, quantity: 1 }]);
    }),
  ),
);

const succeeded = results.filter((r) => r.status === 'fulfilled').length;
const soldOut = results.filter(
  (r) => r.status === 'rejected' && r.reason instanceof InsufficientStockError,
).length;
const unexpected = results.filter(
  (r) => r.status === 'rejected' && !(r.reason instanceof InsufficientStockError),
);

const remaining = await stockOf();
const engine = process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('pglite:')
  ? 'postgres' : 'pglite (logic only)';

console.log(`engine=${engine}  attempts=${ATTEMPTS}  stock=${STOCK}`);
console.log(`  succeeded=${succeeded}  sold-out=${soldOut}  other-failures=${unexpected.length}  remaining=${remaining}`);
if (unexpected.length) console.log('  first unexpected:', String((unexpected[0] as PromiseRejectedResult).reason).slice(0, 160));

assert.equal(succeeded, STOCK, `exactly ${STOCK} orders must succeed — never more`);
assert.equal(remaining, 0, 'stock must land exactly on zero');
assert.equal(succeeded + soldOut + unexpected.length, ATTEMPTS, 'every attempt accounted for');
assert.equal(unexpected.length, 0, 'no deadlocks or unexpected errors');

await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log('concurrency: no oversell');
process.exit(0);
