/**
 * The seed must not destroy order history.
 * Run: npm run test:seed-safety -w backend   (stop the API first)
 *
 * TRUNCATE ... CASCADE ignores ON DELETE SET NULL and truncates every
 * referencing table — which silently wiped order_items, the snapshots that
 * exist precisely so an invoice survives a product being discontinued.
 */
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './client.js';
import { orders, orderItems, products, variants, reviews } from './schema.js';
import { createOrder } from '../services/orders.js';

const db = getDb();

/**
 * Seeded at both ends: this test empties the catalogue, so it must neither
 * depend on a previous test having filled it nor leave it empty for the next.
 */
process.env.FORCE_SEED = '1';
const { runSeed } = await import('./seed.js');
await runSeed();

const order = await createOrder({
  items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 2 }],
  customer: { name: 'Seed Safety', phone: '9876543210' },
  shipping: { address: '1 Seed Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
  paymentMethod: 'cod',
  idempotencyKey: `seed-safety-${Date.now()}`,
});

const [row] = await db.select().from(orders).where(eq(orders.orderNumber, order.orderNumber)).limit(1);
const itemsBefore = await db.select().from(orderItems).where(eq(orderItems.orderId, row!.id));
assert.equal(itemsBefore.length, 1, 'the order has a line item');
const snapshot = itemsBefore[0]!;

// Perform the seed's destructive step in-process. A subprocess cannot be
// used here: PGlite is single-process, so a spawned seed would open a
// different, empty database and appear to pass.
await db.execute(sql`delete from ${reviews}`);
await db.execute(sql`delete from ${variants}`);
await db.execute(sql`delete from ${products}`);

const itemsAfter = await db.select().from(orderItems).where(eq(orderItems.orderId, row!.id));
assert.equal(itemsAfter.length, 1, 'the line item survives a reseed');

const after = itemsAfter[0]!;
assert.equal(after.productName, snapshot.productName, 'the product name snapshot survives');
assert.equal(after.unitPricePaise, snapshot.unitPricePaise, 'the price snapshot survives');
assert.equal(after.lineTotalPaise, snapshot.lineTotalPaise);
assert.equal(after.productId, null, 'the product reference is nulled, not the row deleted');

const [orderAfter] = await db.select().from(orders).where(eq(orders.orderNumber, order.orderNumber)).limit(1);
assert.ok(orderAfter, 'the order itself survives');
assert.equal(orderAfter!.totalPaise, row!.totalPaise);

await db.execute(sql`delete from ${orders} where order_number = ${order.orderNumber}`);

// This test empties the catalogue, so it must put it back — otherwise every
// test that runs afterwards fails against an empty database.
await runSeed();

console.log('seed safety: order history survives the catalogue being replaced');

// PGlite holds the process open; exit explicitly.
process.exit(0);
