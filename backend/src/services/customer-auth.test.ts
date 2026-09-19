/**
 * The OTP rules from docs/AUTH.md §4, asserted.
 *
 * Every one of these failing is silent: nobody sees a wrong code accepted, a
 * dead code still working, or a brute-force getting unlimited guesses. They
 * only show up as an account somebody else got into.
 *
 *   npm run test:customer-auth -w backend
 */
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { otpCodes, otpSendLog, customers, customerSessions, orders, orderItems } from '../db/schema.js';
import {
  normalisePhone, requestOtp, verifyOtp, customerFromToken, revokeSession,
  purgeExpiredOtps, MAX_VERIFY_ATTEMPTS, OTP_TTL_MS,
} from './customer-auth.js';

const db = getDb();
const PHONE = '9876500001';

/** Capture the code the way the delivery pipe would see it. */
let lastCode = '';
const capture = async (_p: string, code: string) => { lastCode = code; return { simulated: true }; };

/**
 * Removes the test phone entirely, orders included.
 *
 * Unlinking rather than deleting left last run's order behind, so the backfill
 * assertion counted two on the second run and failed. A fixture that only
 * passes the first time is worse than no fixture.
 */
const reset = async (phone: string) => {
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.delete(otpSendLog).where(eq(otpSendLog.phone, phone));

  const mine = await db.select({ id: orders.id }).from(orders).where(eq(orders.phone, phone));
  for (const o of mine) {
    await db.delete(orderItems).where(eq(orderItems.orderId, o.id));
    await db.delete(orders).where(eq(orders.id, o.id));
  }

  const [c] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (c) {
    await db.delete(customerSessions).where(eq(customerSessions.customerId, c.id));
    await db.delete(customers).where(eq(customers.id, c.id));
  }
};

// --- phone normalisation ---------------------------------------------------
assert.equal(normalisePhone('9876543210'), '9876543210');
assert.equal(normalisePhone('+91 98765 43210'), '9876543210', 'country code and spaces are stripped');
assert.equal(normalisePhone('091-9876543210'), '9876543210');
for (const bad of ['123', '1234567890', '5876543210', 'abcdefghij']) {
  assert.throws(() => normalisePhone(bad), /INVALID_PHONE|Enter a 10-digit/, `rejects ${bad}`);
}

// --- the code is never stored ----------------------------------------------
await reset(PHONE);
await requestOtp(PHONE, capture);
const [stored] = await db.select().from(otpCodes).where(eq(otpCodes.phone, PHONE)).limit(1);
assert.ok(stored, 'a code row exists');
assert.ok(lastCode.length === 6 && /^\d{6}$/.test(lastCode), 'six digits');
assert.notEqual(stored!.codeHash, lastCode, 'the code itself must never be stored');
assert.ok(!JSON.stringify(stored).includes(lastCode), 'the code appears nowhere on the row');
assert.equal(stored!.codeHash.length, 64, 'stored as a sha256 HMAC digest');

// --- a wrong code is rejected and burns an attempt --------------------------
const wrong = lastCode === '000000' ? '111111' : '000000';
await assert.rejects(() => verifyOtp(PHONE, wrong), /not right|expired/);
const [afterWrong] = await db.select().from(otpCodes).where(eq(otpCodes.phone, PHONE)).limit(1);
assert.equal(afterWrong!.attempts, 1, 'the attempt is counted');

// --- attempts are capped ----------------------------------------------------
await assert.rejects(() => verifyOtp(PHONE, wrong));
await assert.rejects(() => verifyOtp(PHONE, wrong));
await assert.rejects(() => verifyOtp(PHONE, lastCode), /Too many attempts/,
  'once the cap is hit even the RIGHT code is dead');
assert.equal(MAX_VERIFY_ATTEMPTS, 3);

// --- a fresh code works, and links past guest orders -------------------------
await reset(PHONE);
await db.insert(orders).values({
  orderNumber: `SV-TEST-${Date.now().toString().slice(-6)}`,
  status: 'confirmed', paymentStatus: 'pending', paymentMethod: 'cod',
  customerName: 'Backfill Test', phone: PHONE,
  address: '1 Test St', city: 'Bengaluru', state: 'Karnataka', pincode: '560004',
  subtotalPaise: 11000, totalPaise: 11000,
});
await requestOtp(PHONE, capture);
const ok = await verifyOtp(PHONE, lastCode);
assert.ok(ok.token.length > 20, 'a session token is issued');
assert.equal(ok.isNew, true, 'first sign-in creates the customer');
assert.equal(ok.ordersLinked, 1, 'the guest order placed with this number is now theirs');

// --- one code, one login ----------------------------------------------------
await assert.rejects(() => verifyOtp(PHONE, lastCode), /not right|expired/,
  'a consumed code cannot be reused');

// --- the session resolves, and revoking it stops resolving -------------------
const who = await customerFromToken(ok.token);
assert.equal(who?.phone, PHONE);
assert.equal(await customerFromToken('not-a-real-token'), null);
assert.equal(await customerFromToken(undefined), null);
await revokeSession(ok.token);
assert.equal(await customerFromToken(ok.token), null, 'a revoked session is dead immediately');

// --- expiry is enforced by time, not by a sweep ------------------------------
await reset(PHONE);
await requestOtp(PHONE, capture);
await db.update(otpCodes)
  .set({ expiresAt: new Date(Date.now() - 1000) })
  .where(eq(otpCodes.phone, PHONE));
await assert.rejects(() => verifyOtp(PHONE, lastCode), /not right|expired/,
  'an expired code fails even though the row is still there');
assert.ok((await purgeExpiredOtps()) >= 1, 'and housekeeping can remove it');
assert.equal(OTP_TTL_MS, 5 * 60 * 1000);

// --- resend is throttled -----------------------------------------------------
await reset(PHONE);
await requestOtp(PHONE, capture);
await assert.rejects(() => requestOtp(PHONE, capture), /just sent|Wait a moment/,
  'a second request within the minute is refused');

await reset(PHONE);
console.log('customer auth: code never stored, attempts capped, single-use, expiry and backfill all hold');
process.exit(0);
