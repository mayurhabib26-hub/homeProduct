/**
 * The service worker must never cache a price, a charge, or a reservation.
 *
 * This is the test PWA.md §2 asks for. Caching the wrong route produces no
 * error and no visible failure — a customer simply sees last week's price, or
 * adds a variant that sold out an hour ago — so the only thing standing
 * between a reordered array and a silently broken hard rule 1 is an assertion.
 *
 *   npm run test:pwa -w frontend
 */
import assert from 'node:assert/strict';
import { strategyFor, runtimeCaching } from './runtime-caching.js';

const ORIGIN = 'https://svhomeproducts.example';

const NEVER_CACHE: [string, string, string][] = [
  ['/api/orders', 'POST', ''],
  ['/api/orders/SV-2609-01000', 'GET', ''],
  ['/api/payments/create', 'POST', ''],
  ['/api/payments/verify', 'POST', ''],
  ['/api/coupons/validate', 'POST', ''],
  // The one that looks cacheable and is not: a GET whose whole purpose is
  // refreshing stale prices on a cart that stores only variant ids.
  ['/api/cart/hydrate', 'GET', ''],
  ['/api/auth/login', 'POST', ''],
  ['/api/admin/orders', 'GET', ''],
  ['/api/webhooks/razorpay', 'POST', ''],
];

for (const [path, method, dest] of NEVER_CACHE) {
  const got = strategyFor(`${ORIGIN}${path}`, method, dest);
  assert.equal(got, 'NetworkOnly', `${method} ${path} must be NetworkOnly, got ${got}`);
}

// Razorpay's SDK is not ours to version, and a stale one is a broken checkout.
assert.equal(strategyFor('https://checkout.razorpay.com/v1/checkout.js'), 'NetworkOnly');

// Catalogue reads may go stale — the CDN already serves them stale.
assert.equal(strategyFor(`${ORIGIN}/api/products`), 'StaleWhileRevalidate');
assert.equal(strategyFor(`${ORIGIN}/api/products/rasam-powder`), 'StaleWhileRevalidate');
assert.equal(strategyFor(`${ORIGIN}/api/recipes`), 'StaleWhileRevalidate');

assert.equal(
  strategyFor(`${ORIGIN}/images/rasam_powder_pack.jpg`, 'GET', 'image'),
  'StaleWhileRevalidate',
);
assert.equal(strategyFor('https://fonts.gstatic.com/s/x.woff2'), 'CacheFirst');

/**
 * Order, asserted directly rather than inferred.
 *
 * Every NetworkOnly rule must come before every caching rule. A reordering
 * that still matched each URL individually could pass the checks above while
 * being wrong for a URL nobody thought to list.
 */
const lastNeverCache = runtimeCaching.map((r) => r.handler).lastIndexOf('NetworkOnly');
const firstCaching = runtimeCaching.findIndex((r) => r.handler !== 'NetworkOnly');
assert.ok(
  lastNeverCache < firstCaching,
  'every NetworkOnly rule must precede every caching rule — first match wins',
);

/** A catalogue rule that matched an order route would be caught here. */
for (const [path] of NEVER_CACHE) {
  const caching = runtimeCaching.filter((r) => r.handler !== 'NetworkOnly');
  const url = new URL(`${ORIGIN}${path}`);
  for (const rule of caching) {
    assert.ok(
      !rule.urlPattern({ url, request: { method: 'GET', destination: '' } }),
      `a caching rule also matches ${path} — it is only safe because of ordering`,
    );
  }
}

console.log(`pwa caching: ${NEVER_CACHE.length + 1} never-cache routes verified, order correct`);
