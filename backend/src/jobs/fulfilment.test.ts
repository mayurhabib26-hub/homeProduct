/**
 * Order -> job -> worker -> notification, end to end.
 * Run: npm run test:fulfilment -w backend  (stop the API first)
 *
 * Providers are unconfigured here, so sends are simulated and logged. What is
 * being tested is the wiring: that the right job is enqueued at the right
 * lifecycle point, exactly once, and that the handler completes.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { jobs } from '../db/schema.js';
import { createOrder } from '../services/orders.js';
import { transitionOrder } from '../services/order-status.js';
import { claimJob, completeJob, queueDepth } from '../lib/queue.js';
import { runJob } from './handlers.js';

const db = getDb();
const VARIANT = await testVariantId();
await db.execute(sql`delete from ${jobs}`);
await db.execute(sql`update variants set stock_qty = 50 where id = ${VARIANT}`);

const drain = async () => {
  const done: string[] = [];
  for (;;) {
    const job = await claimJob(['notifications', 'fulfilment', 'documents']);
    if (!job) break;
    await runJob(job.queue, job.payload);
    await completeJob(job.id);
    done.push(String(job.payload.type));
  }
  return done;
};

/* --- a COD order confirms immediately and queues its confirmation ------- */
const order = await createOrder({
  items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 2 }],
  customer: { name: 'Fulfilment Test', phone: '9876543210', email: 'test@example.com' },
  shipping: { address: '9 Kitchen Lane', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
  paymentMethod: 'cod',
  idempotencyKey: `fulfilment-test-${Date.now()}`,
});

assert.equal(order.status, 'confirmed');
let depth = await queueDepth();
// A confirmed order queues both a confirmation and its tax invoice.
assert.equal(depth.pending, 2, 'confirmation and invoice queued');

const afterConfirm = (await drain()).sort();
assert.deepEqual(
  afterConfirm,
  ['invoice.issue', 'order.confirmation'],
  'both handlers ran',
);

/* --- packing books a shipment ------------------------------------------ */
await transitionOrder(order.orderNumber, 'packed');
depth = await queueDepth();
assert.equal(depth.pending, 1, 'packing queues a booking');

const afterPack = await drain();
assert.deepEqual(afterPack, ['shipment.book'], 'the booking handler ran');

/* --- shipping WITHOUT a tracking number sends nothing ------------------ */
await transitionOrder(order.orderNumber, 'shipped');
depth = await queueDepth();
assert.ok(
  !depth.pending,
  'no dispatch message without an AWB — "dispatched" with no tracking is worse than silence',
);

/* --- a repeated idempotency key queues nothing extra -------------------- */
await db.execute(sql`delete from ${jobs}`);

// The SAME key both times — that is the whole point. Generating a fresh one
// per call creates two orders and tests nothing.
const sharedKey = `dedupe-test-${Date.now()}`;
const line = {
  items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 1 }],
  customer: { name: 'Dedupe Test', phone: '9876543210' },
  shipping: { address: '9 Kitchen Lane', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
  paymentMethod: 'cod' as const,
  idempotencyKey: sharedKey,
};

const repeat = await createOrder(line);
const again = await createOrder(line);
assert.equal(again.orderNumber, repeat.orderNumber, 'the same key returns the same order');

// One confirmed order queues exactly two jobs: its confirmation and its
// invoice. The repeat must add nothing.
const finalDepth = await queueDepth();
assert.equal(finalDepth.pending ?? 0, 2, 'a repeated order queues nothing extra');

await db.execute(sql`delete from ${jobs}`);
await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log(`fulfilment: order ${repeat.orderNumber} — wiring verified end to end`);
process.exit(0);
