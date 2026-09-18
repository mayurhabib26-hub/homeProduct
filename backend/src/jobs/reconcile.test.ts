/**
 * Stale-order sweep. Run: npm run test:reconcile -w backend
 *
 * An order that never pays holds stock. If nothing releases it, a burst of
 * abandoned checkouts quietly makes a product unbuyable.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { createOrder } from '../services/orders.js';
import { sweepStaleOrders, type ReconciliationReport } from './reconcile.js';

const db = getDb();
const VARIANT = await testVariantId();
const stockOf = async (id: number) => {
  const r = (await db.execute(sql`select stock_qty from variants where id = ${id}`)) as unknown as
    | { rows?: Array<{ stock_qty: number }> } | Array<{ stock_qty: number }>;
  const rows = Array.isArray(r) ? r : (r.rows ?? []);
  return Number(rows[0]!.stock_qty);
};

await db.execute(sql`update variants set stock_qty = 20 where id = ${VARIANT}`);
const before = await stockOf(VARIANT);

const order = await createOrder({
  items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 3 }],
  customer: { name: 'Abandoned Cart', phone: '9876543210' },
  shipping: { address: '1 Test Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
  paymentMethod: 'upi',
  idempotencyKey: `stale-test-${Date.now()}`,
});

assert.equal(await stockOf(VARIANT), before - 3, 'a pending order holds its stock');

// A fresh pending order must NOT be swept — the customer may still be paying.
const fresh: ReconciliationReport = {
  staleReleased: [], staleRecovered: [], paymentsWithoutOrder: [], amountMismatches: [], checkedPayments: 0,
};
await sweepStaleOrders(fresh);
assert.equal(fresh.staleReleased.length, 0, 'a recent pending order is left alone');
assert.equal(await stockOf(VARIANT), before - 3, 'stock still held');

// Backdate it past the threshold.
await db.execute(sql`
  update orders set created_at = now() - interval '45 minutes'
   where order_number = ${order.orderNumber}`);

const report: ReconciliationReport = {
  staleReleased: [], staleRecovered: [], paymentsWithoutOrder: [], amountMismatches: [], checkedPayments: 0,
};
await sweepStaleOrders(report);

assert.ok(report.staleReleased.includes(order.orderNumber), 'the stale order was released');
assert.equal(await stockOf(VARIANT), before, 'its stock came back');

const statusResult = await db.execute(sql`
  select status from orders where order_number = ${order.orderNumber}`);
const statusRows = (Array.isArray(statusResult)
  ? statusResult
  : (statusResult as { rows?: Array<{ status: string }> }).rows ?? []) as Array<{ status: string }>;
assert.equal(statusRows[0]!.status, 'failed', 'the order is marked failed, not left pending');

// Sweeping again must not double-restock.
const again: ReconciliationReport = {
  staleReleased: [], staleRecovered: [], paymentsWithoutOrder: [], amountMismatches: [], checkedPayments: 0,
};
await sweepStaleOrders(again);
assert.equal(await stockOf(VARIANT), before, 'a second sweep does not restock twice');

await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log('reconcile.ts: stale sweep releases stock exactly once');
process.exit(0);
