/**
 * Consent and erasure. Run: npm run test:consent -w backend  (stop the API)
 *
 * Erasure is the one that must be exactly right: too little leaves PII
 * behind, too much destroys a financial record GST requires kept for 8 years.
 */
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { orders, marketingConsent } from '../db/schema.js';
import { createOrder } from './orders.js';
import { recordMarketingConsent, hasMarketingConsent, erasePersonalData } from './consent.js';

const db = getDb();
const VARIANT = await testVariantId();
const PHONE = '9812345678';
await db.execute(sql`delete from ${marketingConsent} where phone = ${PHONE}`);
await db.execute(sql`update variants set stock_qty = 60 where id = ${VARIANT}`);

/* --- consent defaults to absent and is the latest decision ------------- */
assert.equal(await hasMarketingConsent(PHONE), false, 'no record means no consent');

await recordMarketingConsent(PHONE, 'x@example.com', true, 'checkout');
assert.equal(await hasMarketingConsent(PHONE), true);

await recordMarketingConsent(PHONE, 'x@example.com', false, 'unsubscribe');
assert.equal(await hasMarketingConsent(PHONE), false, 'withdrawal overrides earlier consent');

/* --- erasure removes PII but keeps the money --------------------------- */
const order = await createOrder({
  items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 2 }],
  customer: { name: 'Erasure Test', phone: PHONE, email: 'erase@example.com' },
  shipping: { address: '77 Private Lane', landmark: 'Near the temple', city: 'Bengaluru', state: 'Karnataka', pincode: '560004' },
  paymentMethod: 'cod',
  idempotencyKey: `erasure-test-${Date.now()}`,
});

const [before] = await db.select().from(orders).where(eq(orders.orderNumber, order.orderNumber)).limit(1);
assert.equal(before!.customerName, 'Erasure Test');
const totalBefore = before!.totalPaise;

const result = await erasePersonalData(PHONE, 'customer request');
assert.ok(result.ordersAnonymised >= 1, 'the order was anonymised');
assert.ok(result.consentRecordsRemoved >= 1, 'consent records were removed');

const [after] = await db.select().from(orders).where(eq(orders.orderNumber, order.orderNumber)).limit(1);

// PII gone.
assert.notEqual(after!.customerName, 'Erasure Test');
assert.notEqual(after!.phone, PHONE, 'the phone number no longer identifies them');
assert.equal(after!.email, null);
assert.notEqual(after!.address, '77 Private Lane');
assert.equal(after!.landmark, null);

// Financial record intact — GST requires 8 years.
assert.equal(after!.orderNumber, order.orderNumber, 'the order number survives');
assert.equal(after!.totalPaise, totalBefore, 'the amount survives');
assert.ok(after!.createdAt, 'the date survives');
assert.equal(after!.paymentMethod, 'cod');

// The erased phone must not collide with a real one on a second erasure.
const second = await erasePersonalData(PHONE, 'repeat request');
assert.equal(second.ordersAnonymised, 0, 'nothing left to erase for that number');

await db.execute(sql`delete from ${marketingConsent} where phone = ${PHONE}`);
await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log('consent.ts: PII erased, financial record intact');
process.exit(0);
