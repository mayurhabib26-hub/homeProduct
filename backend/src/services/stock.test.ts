/**
 * Stock guard checks. Run against a seeded database:
 *   npm run test:stock -w backend   (stop the API first — PGlite is single-process)
 *
 * NOTE ON CONCURRENCY: PGlite is in-process and single-writer, so these prove
 * the guard's *logic* — that the conditional update refuses to go negative and
 * reports it. They cannot prove behaviour under lock contention. The
 * 200-concurrent-orders test in docs/TESTING.md §3 must run against a real
 * Postgres before this ships. This file does not stand in for it.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { decrementStock, restoreStock, InsufficientStockError } from './stock.js';

const db = getDb();
const VARIANT = await testVariantId();
const stockOf = async (id: number): Promise<number> => {
  const r = (await db.execute(sql`select stock_qty from variants where id = ${id}`)) as unknown as
    | { rows?: Array<{ stock_qty: number }> }
    | Array<{ stock_qty: number }>;
  const rows = Array.isArray(r) ? r : (r.rows ?? []);
  return Number(rows[0]!.stock_qty);
};

await db.execute(sql`update variants set stock_qty = 10 where id = ${VARIANT}`);

// happy path
await decrementStock(db, [{ variantId: VARIANT, quantity: 3 }]);
assert.equal(await stockOf(VARIANT), 7, 'decrement applied');

// exactly the remaining stock is allowed
await decrementStock(db, [{ variantId: VARIANT, quantity: 7 }]);
assert.equal(await stockOf(VARIANT), 0, 'selling the last unit is allowed');

// one more is refused, and refused by rowCount, not by an exception from the
// CHECK constraint — the guard must reject cleanly
await assert.rejects(
  () => decrementStock(db, [{ variantId: VARIANT, quantity: 1 }]),
  (e: unknown) => e instanceof InsufficientStockError,
  'selling past zero is refused',
);
assert.equal(await stockOf(VARIANT), 0, 'a refused decrement changes nothing');

// asking for more than exists in one go
await db.execute(sql`update variants set stock_qty = 5 where id = ${VARIANT}`);
await assert.rejects(
  () => decrementStock(db, [{ variantId: VARIANT, quantity: 6 }]),
  (e: unknown) => e instanceof InsufficientStockError,
);
assert.equal(await stockOf(VARIANT), 5, 'over-request leaves stock untouched');

// restore
await restoreStock(db, [{ variantId: VARIANT, quantity: 4 }]);
assert.equal(await stockOf(VARIANT), 9, 'restore adds back');

// the database itself still refuses to go negative, whatever the code does
await assert.rejects(
  () => db.execute(sql`update variants set stock_qty = -1 where id = ${VARIANT}`),
  'CHECK constraint holds independently of application logic',
);

await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log('stock.ts: all assertions passed (logic only — see note on concurrency)');
process.exit(0);
