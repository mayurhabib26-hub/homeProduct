/**
 * Service-worker route strategies. See docs/PWA.md §2.
 *
 * In its own module so it can be tested. The correctness property here is
 * invisible at runtime — cache the wrong route and nothing errors, a customer
 * simply pays last week's price — so it needs an assertion, not a review.
 *
 * ORDER IS THE SAFETY PROPERTY. Workbox takes the first rule whose pattern
 * matches. Every never-cache route is listed before any rule that could also
 * match it; moving the catalogue rule above the NetworkOnly block would undo
 * hard rule 1 silently.
 */
export interface CacheRule {
  urlPattern: (ctx: { url: URL; request: { method: string; destination: string } }) => boolean;
  handler: 'NetworkOnly' | 'StaleWhileRevalidate' | 'CacheFirst';
  options?: Record<string, unknown>;
}

export const runtimeCaching: CacheRule[] = [
  {
    /**
     * Never cached. Anything that prices, charges, or reserves.
     *
     * `/api/cart` is the one that looks safe and is not: cart hydration
     * is a GET whose entire purpose is refreshing stale prices on a
     * cart that stores only variant ids. Caching it defeats the reason
     * it exists.
     */
    urlPattern: ({ url }) =>
      /^\/api\/(orders|payments|coupons|cart|auth|admin|webhooks)(\/|$)/.test(url.pathname),
    handler: 'NetworkOnly',
  },
  {
    // Not our asset to version, and a stale payment SDK is a broken
    // checkout.
    urlPattern: ({ url }) => url.hostname.endsWith('razorpay.com'),
    handler: 'NetworkOnly',
  },
  {
    /**
     * Catalogue reads tolerate staleness because they are already
     * served stale by design — the CDN carries s-maxage=60,
     * stale-while-revalidate=300. This extends an accepted window
     * rather than opening a new one, so maxAgeSeconds matches it.
     */
    urlPattern: ({ url, request }) =>
      request.method === 'GET' && /^\/api\/(products|recipes)(\/|$)/.test(url.pathname),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'catalogue',
      expiration: { maxEntries: 60, maxAgeSeconds: 300 },
      // Without this a 500 is cached and replayed as if it were the
      // catalogue.
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: ({ url, request }) =>
      request.destination === 'image' && /^\/(images|uploads)\//.test(url.pathname),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'product-images',
      expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    // The stylesheet changes when the font list does; revalidate it.
    urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com',
    handler: 'StaleWhileRevalidate',
    options: { cacheName: 'google-fonts-stylesheets' },
  },
  {
    // The font files themselves are immutable and content-addressed.
    urlPattern: ({ url }) => url.hostname === 'fonts.gstatic.com',
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts-files',
      expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
];

/**
 * Which strategy a given request would actually get — first match wins, the
 * same way workbox resolves it. Exported for the test.
 */
export function strategyFor(
  href: string,
  method = 'GET',
  destination = '',
): CacheRule['handler'] | 'Precache/None' {
  const url = new URL(href);
  const ctx = { url, request: { method, destination } };
  return runtimeCaching.find((r) => r.urlPattern(ctx))?.handler ?? 'Precache/None';
}
