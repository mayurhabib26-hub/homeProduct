/**
 * Two claims worth asserting rather than reviewing:
 *
 *   nothing is sent before consent, and nothing personal is ever sent.
 *
 * Both fail silently in production — a leak looks like a normal event and
 * shows up in someone else's dashboard.
 *
 *   npm run test:analytics -w frontend
 */
import assert from 'node:assert/strict';
import { scrub, FORBIDDEN_FIELDS } from './analytics.js';

// --- nothing personal survives scrub ---------------------------------------
const leaky = {
  transaction_id: 'SV-2609-01000',
  value: 470,
  currency: 'INR',
  name: 'Ramesh Kumar',
  phone: '9886098860',
  email: 'ramesh@example.com',
  address: '12 Kitchen Street',
  city: 'Bengaluru',
  pincode: '560004',
  landmark: 'near the temple',
  utr: 'UTR123456',
};
const clean = scrub(leaky);

for (const f of FORBIDDEN_FIELDS) {
  assert.ok(!(f in clean), `${f} must never reach analytics`);
}
assert.equal(clean.transaction_id, 'SV-2609-01000', 'the order number is allowed — it is in the URL anyway');
assert.equal(clean.value, 470);
assert.equal(clean.currency, 'INR');

// --- and not inside nested items either ------------------------------------
const nested = scrub({
  items: [{ item_id: 'rasam-powder-100g', item_name: 'Rasam Powder', price: 110, phone: '9886098860' }],
});
const item = (nested.items as Record<string, unknown>[])[0]!;
assert.ok(!('phone' in item), 'a forbidden field nested in items must be stripped too');
assert.equal(item.item_id, 'rasam-powder-100g');

// --- undefined and null are dropped, not sent as "undefined" ---------------
const sparse = scrub({ value: 0, missing: undefined, empty: null, weight: '100g' });
assert.ok(!('missing' in sparse) && !('empty' in sparse));
assert.equal(sparse.value, 0, 'zero is a real value and must survive');

/**
 * Consent gate. Without a measurement id the module is inert, which is the
 * state every developer machine and CI run is in — so this asserts the
 * unconfigured path rather than pretending a tag exists.
 */
const { analyticsConfigured, getConsent } = await import('./analytics.js');
assert.equal(typeof analyticsConfigured, 'boolean');
assert.ok(['granted', 'denied', 'unset'].includes(getConsent()),
  'consent must resolve to a known state even with no localStorage');
assert.equal(getConsent(), 'unset', 'default is unset — which means denied until asked');

console.log(`analytics: ${FORBIDDEN_FIELDS.length} forbidden fields stripped, consent defaults to unset`);
