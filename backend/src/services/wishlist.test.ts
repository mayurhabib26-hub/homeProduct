/**
 * The wishlist, and the one property that matters: signing in MERGES rather
 * than replaces.
 *
 * Losing someone's saved products as a reward for making an account is
 * exactly backwards, and it fails silently — the list simply comes back
 * shorter and nobody knows what was in it.
 *
 *   npm run test:wishlist -w backend
 */
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { createApp } from '../app.js';
import { getDb } from '../db/client.js';
import { customers, customerSessions, wishlistItems, otpCodes, otpSendLog } from '../db/schema.js';
import { requestOtp, verifyOtp } from './customer-auth.js';

const db = getDb();
const A = '9876591001';
const B = '9876591002';

for (const phone of [A, B]) {
  const [c] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (c) {
    await db.delete(wishlistItems).where(eq(wishlistItems.customerId, c.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, c.id));
    await db.delete(customers).where(eq(customers.id, c.id));
  }
  await db.delete(otpCodes).where(eq(otpCodes.phone, phone));
  await db.delete(otpSendLog).where(eq(otpSendLog.phone, phone));
}

async function signIn(phone: string): Promise<string> {
  let code = '';
  await requestOtp(phone, async (_p, c) => { code = c; return { simulated: true }; });
  return (await verifyOtp(phone, code)).token;
}

const tokenA = await signIn(A);
const tokenB = await signIn(B);

const app = createApp();
const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const port = (server.address() as { port: number }).port;

const call = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${port}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: `sv_customer=${token}`, ...init.headers },
  });
const slugs = async (res: Response): Promise<string[]> =>
  ((await res.json()) as { data: string[] }).data;

// --- signed out gets nothing ------------------------------------------------
assert.equal((await fetch(`http://127.0.0.1:${port}/api/auth/wishlist`)).status, 401);

// --- the account already holds something -----------------------------------
await call('/auth/wishlist', tokenA, { method: 'POST', body: JSON.stringify({ slugs: ['sambar-powder'] }) });

// --- signing in with a guest list MERGES, never replaces --------------------
const merged = await slugs(await call('/auth/wishlist', tokenA, {
  method: 'POST', body: JSON.stringify({ slugs: ['rasam-powder', 'idli-chutney-podi'] }),
}));
assert.equal(merged.length, 3, 'the account keeps what it had AND gains the guest saves');
for (const s of ['sambar-powder', 'rasam-powder', 'idli-chutney-podi']) {
  assert.ok(merged.includes(s), `${s} survived the merge`);
}

// --- merging the same list again is a no-op, so a retry is safe -------------
const again = await slugs(await call('/auth/wishlist', tokenA, {
  method: 'POST', body: JSON.stringify({ slugs: ['rasam-powder', 'sambar-powder'] }),
}));
assert.equal(again.length, 3, 'duplicates do not accumulate');

// --- removal ----------------------------------------------------------------
await call('/auth/wishlist/rasam-powder', tokenA, { method: 'DELETE' });
const afterRemove = await slugs(await call('/auth/wishlist', tokenA));
assert.equal(afterRemove.length, 2);
assert.ok(!afterRemove.includes('rasam-powder'));

// --- one customer cannot see or touch another's ------------------------------
assert.deepEqual(await slugs(await call('/auth/wishlist', tokenB)), [], "B's list is their own");
await call('/auth/wishlist/sambar-powder', tokenB, { method: 'DELETE' });
assert.equal((await slugs(await call('/auth/wishlist', tokenA))).length, 2,
  "B deleting a slug must not touch A's list");

// --- junk is refused ---------------------------------------------------------
const bad = await call('/auth/wishlist', tokenA, {
  method: 'POST', body: JSON.stringify({ slugs: ['../../etc/passwd'] }),
});
assert.equal(bad.status, 400, 'a slug that is not a slug is refused');

server.close();
for (const phone of [A, B]) {
  const [c] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (c) {
    await db.delete(wishlistItems).where(eq(wishlistItems.customerId, c.id));
    await db.delete(customerSessions).where(eq(customerSessions.customerId, c.id));
  }
}
await db.delete(customers).where(inArray(customers.phone, [A, B]));
await db.delete(otpCodes).where(inArray(otpCodes.phone, [A, B]));
await db.delete(otpSendLog).where(inArray(otpSendLog.phone, [A, B]));

console.log('wishlist: merges rather than replaces, repeatable, scoped to its owner');
process.exit(0);
