/**
 * State machine rules. Run: npm run test:status -w backend
 * Pure logic — no database needed.
 */
import assert from 'node:assert/strict';
import { canTransition, allowedFrom, type OrderStatus } from './order-status.js';

/* --- the happy path --------------------------------------------------- */
assert.ok(canTransition('pending', 'confirmed'));
assert.ok(canTransition('confirmed', 'packed'));
assert.ok(canTransition('packed', 'shipped'));
assert.ok(canTransition('shipped', 'delivered'));

/* --- time does not run backwards -------------------------------------- */
assert.equal(canTransition('delivered', 'pending'), false);
assert.equal(canTransition('shipped', 'confirmed'), false);
assert.equal(canTransition('packed', 'pending'), false);
assert.equal(canTransition('delivered', 'shipped'), false);

/* --- terminal states stay terminal ------------------------------------ */
assert.deepEqual(allowedFrom('failed'), [], 'a failed order is final');
assert.deepEqual(allowedFrom('refunded'), [], 'a refunded order is final');
for (const to of ['pending', 'confirmed', 'packed', 'shipped', 'delivered'] as OrderStatus[]) {
  assert.equal(canTransition('refunded', to), false, `refunded must not become ${to}`);
  assert.equal(canTransition('failed', to), false, `failed must not become ${to}`);
}

/* --- a shipped order cannot simply be cancelled ------------------------ */
assert.equal(canTransition('shipped', 'cancelled'), false, 'it is already with a courier — RTO, not cancel');
assert.ok(canTransition('shipped', 'rto'));
assert.ok(canTransition('rto', 'refunded'));

/* --- returns and refunds ---------------------------------------------- */
assert.ok(canTransition('delivered', 'returned'));
assert.ok(canTransition('returned', 'refunded'));
assert.ok(canTransition('cancelled', 'refunded'));
assert.equal(canTransition('delivered', 'refunded'), false, 'a refund follows a return, not a delivery');

/* --- nothing loops back into pending ----------------------------------- */
const all: OrderStatus[] = [
  'pending', 'confirmed', 'packed', 'shipped', 'delivered',
  'cancelled', 'failed', 'rto', 'returned', 'refunded',
];
for (const from of all) {
  assert.equal(canTransition(from, 'pending'), false, `${from} must not return to pending`);
}

/* --- every target is a known status ------------------------------------ */
for (const from of all) {
  for (const to of allowedFrom(from)) {
    assert.ok(all.includes(to), `${from} -> ${to} is not a known status`);
  }
}

console.log('order-status.ts: all assertions passed');
