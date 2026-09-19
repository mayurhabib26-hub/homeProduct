/**
 * GA4, gated on consent.
 *
 * Three rules this module exists to keep:
 *
 *   1. Nothing loads until the visitor opts in. Under the DPDP Act consent is
 *      an affirmative act, so the default is denied and the Google tag is not
 *      fetched at all until it changes. A banner that sets a flag while the
 *      tag is already running is not consent.
 *   2. No personal data ever reaches Google. Events carry an order number, a
 *      value and item ids — never a name, phone, email or address. This is
 *      hard rule 6 applied to a third party, where it matters more, not less.
 *   3. Unconfigured, every call is a no-op. No measurement id means no tag,
 *      no warnings, no broken pages.
 *
 * VITE_GA4_MEASUREMENT_ID is public by design — it ships in the bundle and is
 * visible in any GA4-instrumented page's source. Hard rule 5 is satisfied
 * because there is no secret here, not because we hid one.
 */
// Optional-chained because the test runs this module under plain node, where
// import.meta.env does not exist. Unconfigured is a supported state anyway.
const MEASUREMENT_ID = import.meta.env?.VITE_GA4_MEASUREMENT_ID as string | undefined;
const STORAGE_KEY = 'sv.analytics-consent';

export type ConsentState = 'granted' | 'denied' | 'unset';

type GtagArgs = [string, ...unknown[]];
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: GtagArgs) => void;
  }
}

export const analyticsConfigured = Boolean(MEASUREMENT_ID);

/**
 * Reads survive republishes but can throw in a private window or with site
 * data blocked, so every access is guarded and an unreadable store means
 * "unset" — which means denied until asked.
 */
export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : 'unset';
  } catch {
    return 'unset';
  }
}

let loaded = false;

function loadTag(): void {
  if (loaded || !MEASUREMENT_ID) return;
  loaded = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: GtagArgs) {
    window.dataLayer!.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    // We route page_view ourselves so a client-side route change is counted
    // once, not once by the tag and once by us.
    send_page_view: false,
    anonymize_ip: true,
  });

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

export function setConsent(state: 'granted' | 'denied'): void {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    // A viewer who cannot store the choice is asked again next visit, which
    // is the conservative outcome.
  }
  if (state === 'granted') loadTag();
}

/** Call once at startup: re-arms the tag for a visitor who already opted in. */
export function initAnalytics(): void {
  if (getConsent() === 'granted') loadTag();
}

/**
 * Field names that must never be sent, checked at the boundary rather than
 * trusted to every call site. Exported for the test.
 */
export const FORBIDDEN_FIELDS = [
  'name', 'customerName', 'phone', 'email', 'address', 'landmark',
  'pincode', 'city', 'utr', 'password', 'token',
];

/** Strips anything personal and drops undefined, so a typo cannot leak. */
export function scrub(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (FORBIDDEN_FIELDS.includes(k)) continue;
    out[k] = Array.isArray(v)
      ? v.map((i) => (i && typeof i === 'object' ? scrub(i as Record<string, unknown>) : i))
      : v;
  }
  return out;
}

function track(event: string, params: Record<string, unknown> = {}): void {
  if (!MEASUREMENT_ID || getConsent() !== 'granted' || !window.gtag) return;
  window.gtag('event', event, scrub(params));
}

/** Rupees, because GA4 reports currency — paise stays the unit everywhere else. */
const rupees = (paise: number) => Number((paise / 100).toFixed(2));

export interface TrackedItem {
  slug: string;
  name: string;
  weight?: string;
  pricePaise: number;
  quantity?: number;
}

const toGa4Item = (i: TrackedItem) => ({
  item_id: i.weight ? `${i.slug}-${i.weight}` : i.slug,
  item_name: i.name,
  item_variant: i.weight,
  price: rupees(i.pricePaise),
  quantity: i.quantity ?? 1,
});

export const pageView = (path: string, title: string) =>
  track('page_view', { page_path: path, page_title: title });

export const viewItem = (item: TrackedItem) =>
  track('view_item', { currency: 'INR', value: rupees(item.pricePaise), items: [toGa4Item(item)] });

export const addToCart = (item: TrackedItem) =>
  track('add_to_cart', {
    currency: 'INR',
    value: rupees(item.pricePaise * (item.quantity ?? 1)),
    items: [toGa4Item(item)],
  });

export const removeFromCart = (item: TrackedItem) =>
  track('remove_from_cart', { currency: 'INR', items: [toGa4Item(item)] });

export const beginCheckout = (items: TrackedItem[], totalPaise: number) =>
  track('begin_checkout', {
    currency: 'INR',
    value: rupees(totalPaise),
    items: items.map(toGa4Item),
  });

/**
 * The order number is the only identifier that goes to Google, and it is the
 * same one that appears in a URL and on an invoice. Everything else about the
 * customer stays here.
 */
export const purchase = (orderNumber: string, totalPaise: number, items: TrackedItem[]) =>
  track('purchase', {
    transaction_id: orderNumber,
    currency: 'INR',
    value: rupees(totalPaise),
    items: items.map(toGa4Item),
  });
