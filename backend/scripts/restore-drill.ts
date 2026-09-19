/**
 * Backup restore drill.
 *
 * Proves two things, in this order:
 *
 *   1. A healthy database passes every post-restore check.
 *   2. A database damaged the way a real restore damages one — rows loaded,
 *      sequences left behind — FAILS those checks.
 *
 * The second half is the point. A verifier nobody has watched fail is a
 * verifier nobody should trust, and "all checks passed" on a checker that
 * cannot fail is worse than no checker at all.
 *
 *   npm run db:restore-drill -w backend        (needs a real Postgres)
 *
 * See docs/DEPLOYMENT.md §6.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../src/db/client.js';
import { verifyRestore } from '../src/db/verify-restore.js';
import { createOrder } from '../src/services/orders.js';
import { issueInvoice } from '../src/services/invoices.js';
import { variants, products } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('pglite:')) {
  console.error('restore-drill needs a real Postgres. Run it through scripts/with-postgres.mjs.');
  process.exit(2);
}

// --- transactional data, so the checks have something to check -------------
const [v] = await db.select({ id: variants.id, weight: variants.weight, slug: products.slug })
  .from(variants).innerJoin(products, eq(products.id, variants.productId))
  .where(eq(variants.active, true)).limit(1);
assert.ok(v, 'seed the database before running the drill');

let invoiced = 0;
for (let i = 0; i < 3; i++) {
  const order = await createOrder({
    items: [{ productSlug: v.slug, weight: v.weight, quantity: 1 }],
    customer: { name: 'Restore Drill', phone: '9000000000' },
    shipping: { address: '1 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
    paymentMethod: 'cod',
    idempotencyKey: `restore-drill-${i}-${Date.now()}`,
  });
  try {
    await issueInvoice(order.orderNumber);
    invoiced++;
  } catch (err) {
    // Invoicing refuses to run until the compliance values are real. That is
    // correct, and not this drill's problem: the sequence checks are what
    // matter here and orders alone exercise them. Set the values to cover the
    // invoice numbering checks too.
    if ((err as { code?: string }).code !== 'INVOICING_NOT_CONFIGURED') throw err;
  }
}
console.log(`drill data: 3 orders, ${invoiced} invoices`
  + (invoiced === 0 ? '  (invoicing not configured — sequence checks still apply)' : '') + '\n');

// --- 1. healthy database must pass -----------------------------------------
console.log('=== healthy database ===');
const healthy = await verifyRestore();
assert.deepEqual(healthy, [], 'a healthy database must pass every check');

// --- 2. damage it the way a data-only restore does --------------------------
console.log('\n=== simulating a data-only restore: sequences left behind ===');
await db.execute(sql`select setval(pg_get_serial_sequence('orders', 'id'), 1, false)`);
await db.execute(sql`select setval(pg_get_serial_sequence('invoices', 'id'), 1, false)`);
console.log('  rewound orders_id_seq and invoices_id_seq to 1\n');

const damaged = await verifyRestore();
assert.ok(damaged.length >= 1, `the checks must catch this — caught ${damaged.length}`);
assert.ok(damaged.some((f) => f.includes('orders.id')), 'must flag orders.id');
if (invoiced > 0) {
  assert.ok(damaged.some((f) => f.includes('invoices.id')), 'must flag invoices.id');
}
console.log(`\n  caught ${damaged.length} failures, as intended:`);
for (const f of damaged) console.log(`    - ${f}`);

// --- 3. prove the damage is real, not cosmetic ------------------------------
console.log('\n=== what that would have done in production ===');
let collided = false;
try {
  await createOrder({
    items: [{ productSlug: v.slug, weight: v.weight, quantity: 1 }],
    customer: { name: 'Post Restore', phone: '9000000001' },
    shipping: { address: '2 Test Street', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
    paymentMethod: 'cod',
    idempotencyKey: `post-restore-${Date.now()}`,
  });
} catch (err) {
  collided = true;
  console.log(`  next order failed: ${String(err).split('\n')[0]!.slice(0, 120)}`);
}
assert.ok(collided, 'the rewound sequence must actually break the next insert');

// --- 4. repair and re-verify ------------------------------------------------
console.log('\n=== after repair ===');
for (const t of ['orders', 'invoices']) {
  await db.execute(sql`select setval(
    pg_get_serial_sequence(${t}, 'id'),
    greatest((select coalesce(max(id), 0) from ${sql.identifier(t)}), 1)
  )`);
}
const repaired = await verifyRestore();
assert.deepEqual(repaired, [], 'repair must restore every check to passing');

console.log('\nrestore drill: checks pass clean, fail on damage, and pass again after repair');
process.exit(0);
