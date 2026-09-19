# Progressive Web App

Making the storefront installable and fast on poor connections, without
breaking the guarantee that the server owns price and stock.

---

## 1. What this buys

Ranked honestly. Not every PWA capability is worth having here.

| Capability | Value | Why |
|---|---|---|
| **Install to home screen** | **High** | Repeat customers tap an icon instead of typing a URL. This is the real win. |
| **Instant repeat loads** | **High** | A precached shell opens immediately on a patchy 3G connection |
| **Browse on bad signal** | **Medium** | Catalogue remains viewable in a lift or a basement |
| **Push notifications** | **Low — skip** | Order updates already go over WhatsApp ([AUTH.md §5](./AUTH.md)), which beats web push on reach and engagement in India. iOS also requires the app to be installed before push works at all. |

What a PWA does **not** provide: app-store presence, native payment
integration, or any improvement to the SPA/SEO problem. Prerendering is still
required — see [ARCHITECTURE.md §9](./ARCHITECTURE.md).

The starting point is favourable: the storefront is already a Vite SPA served
as static files from a CDN, which is the cheapest possible base for this.

---

## 2. The risk: cached prices

A service worker caches responses. The entire architecture rests on the server
owning price, stock, and discount ([ARCHITECTURE.md §5](./ARCHITECTURE.md)).

**Cache the wrong route and that guarantee is gone** — a customer sees a
cached ₹110 price for a product now selling at ₹130, or adds a variant that
sold out an hour ago.

So the strategy is declared per route, never left to a plugin default.

| Strategy | Applies to |
|---|---|
| **Precache** (cache-first) | App shell, content-hashed JS and CSS, fonts, logo, icons |
| **Stale-while-revalidate** | Product images, `GET /api/products`, `GET /api/recipes` |
| **Network-only — never cached** | `POST /api/orders`, `/api/payments/*`, `/api/coupons/validate`, `/api/cart/hydrate`, `/api/admin/*`, and Razorpay's `checkout.js` |

Three of those deserve explanation:

**`/api/cart/hydrate` must never be cached.** That endpoint exists precisely
to refresh stale prices on a cart that only stores variant IDs
([API.md §2](./API.md)). Caching it defeats its entire reason for existing.
This is the easiest rule to get wrong, because it is a `GET`-shaped read that
looks cacheable.

**Razorpay's script must never be cached.** A stale payment SDK is a broken
checkout, and it is not our asset to version.

**`/admin/*` is excluded from the service worker scope entirely.** There is no
value in caching a tool used by three people, and stale admin data is worse
than slow admin data.

Catalogue reads tolerate staleness because they are *already* served stale by
design — the CDN carries `s-maxage=60, stale-while-revalidate=300`. The
service worker extends an existing, accepted window. It does not introduce a
new one.

### Implemented

`frontend/pwa/runtime-caching.ts`, imported by `vite.config.ts`. It lives in
its own module for one reason: so it can be tested.

**Order is the safety property.** Workbox takes the first rule whose pattern
matches, so every never-cache route is listed before any rule that could also
match it. Lifting the catalogue rule above the NetworkOnly block would undo
hard rule 1 with no error, no failing build and no visible symptom — just a
customer paying last week's price.

That is exactly the kind of bug a code review does not catch twice, so
`npm run test:pwa -w frontend` asserts it three ways:

1. Each never-cache route resolves to `NetworkOnly` — orders, payments,
   coupon validation, cart hydration, auth, admin, webhooks, and Razorpay's
   `checkout.js`.
2. Every `NetworkOnly` rule sits before every caching rule in the array, so a
   reordering fails even for a URL nobody thought to list.
3. No caching rule matches a never-cache route *at all*, which catches the
   case where the ordering is the only thing keeping it safe.

The test has been shown to fail: moving a broad `/api/` rule to the top
produces `POST /api/orders must be NetworkOnly, got StaleWhileRevalidate`.

---

## 3. No offline checkout

The tempting PWA feature is background sync: accept the order offline, submit
it when connectivity returns.

**Do not build this.**

An order placed against a cached price and submitted twenty minutes later,
against stock that has since sold out, has no good resolution. You either
oversell — the one failure this system is built to prevent — or cancel on a
customer who believes they bought something.

**Browse offline, buy online.** When the network is unavailable at checkout,
show an honest message with the WhatsApp fallback CTA. That path already
exists and is already the designed degradation
([ARCHITECTURE.md §6](./ARCHITECTURE.md)).

The same reasoning rules out optimistic offline coupon validation and offline
stock display beyond the `stale-while-revalidate` window.

---

## 4. Manifest

```
name           S V Home Products
short_name     S V Home
description    Authentic South Indian homemade food products
start_url      /?source=pwa
display        standalone
orientation    portrait
theme_color    #87380F
background     #FAF6F0
icons          192, 512, and a 512 maskable
screenshots    mobile + desktop
shortcuts      Shop · Track Order · Recipes
```

- **`start_url` carries `?source=pwa`** so GA4 can attribute installed
  sessions. Without it, installed traffic is indistinguishable from direct.
- **The maskable icon is not optional.** Without one, Android crops the logo
  into a circle and clips it.
- **Screenshots unlock Chrome's richer install prompt** — the one that shows a
  preview rather than a bare bar. Materially better install rates.
- Icons are generated from the existing `BrandLogo` component, so there is no
  separate asset to keep in sync.
- `theme_color` and `background_color` are the storefront's existing terracotta
  and cream, so the splash screen matches the site rather than flashing white.

---

## 5. iOS

iOS is where PWAs are weakest, and two issues here are specific to this
codebase.

### Safe area insets

The storefront has a `MobileBottomNav`. In standalone mode on a notched
iPhone it renders **underneath the home indicator** unless:

- the viewport meta includes `viewport-fit=cover`, and
- the nav takes `padding-bottom: env(safe-area-inset-bottom)`

This is the single most common cause of "the PWA looks broken on iPhone".
Verify it on a real device or a notched simulator — it does not reproduce in
a desktop browser.

### No install prompt

Safari does not fire `beforeinstallprompt`. iOS users must use
Share → Add to Home Screen manually, so a small custom hint is needed that
detects iOS Safari and shows the instruction. Android gets the real prompt.

### Also required

`apple-touch-icon`, `apple-mobile-web-app-status-bar-style`, and awareness
that iOS may evict storage under pressure — which is another reason nothing
that matters lives only in the cache.

---

## 6. Install prompt timing

Capture `beforeinstallprompt`, call `preventDefault()`, stash the event, and
surface a custom button **after a signal of intent**:

- second visit, or
- immediately after a completed order

Never on first visit. Reflexive dismissal is the default response, and a
dismissed prompt is difficult to resurface. Post-order is the strongest
moment — the customer has just had a good experience and has a reason to
return.

Store the dismissal and do not re-prompt for at least 30 days.

---

## 7. Updates

Use `registerType: 'prompt'`, not `autoUpdate`.

A "New version available — Refresh" toast, and **never shown during
checkout.** An automatic `skipWaiting` reload mid-payment is a lost order and
a confused customer.

Suppress the prompt on `/checkout` and `/order/*`, and show it on the next
navigation instead.

---

## 8. Implementation

`vite-plugin-pwa` (Workbox underneath) covers manifest generation, service
worker build, and precache manifest injection. No hand-written service worker.

Split across two phases, because the caching rules depend on knowing which
routes are API routes:

**Phase 0/1 — installability (~1 day)**
- Manifest, icons from `BrandLogo`, screenshots
- Minimal service worker precaching the shell (required for installability)
- `viewport-fit=cover` and safe-area padding on `MobileBottomNav`
- `apple-touch-icon` and iOS meta tags

This is where most of the value sits, and it is nearly free.

**Phase 7 — caching and polish (~1–2 days)**
- The per-route strategies in §2
- Install-prompt capture and timing
- Update prompt with checkout suppression
- iOS add-to-home-screen hint

Deferring §2 avoids writing the cache configuration twice — before Phase 1 the
catalogue is not yet served over HTTP.

---

## 9. Verification

| Check | Pass condition |
|---|---|
| Lighthouse PWA audit | Installable, no failing checks |
| Android install | Prompt appears, icon correct, launches standalone |
| iOS install | Add to Home Screen works, **bottom nav clears the home indicator** |
| Offline browse | Catalogue renders from cache |
| **Offline checkout** | **Fails honestly with the WhatsApp fallback — never queues** |
| Price change | Admin edits a price; the storefront reflects it within the SWR window |
| Update flow | Deploying mid-session shows the toast, not a silent reload |
| Checkout during update | No toast, no reload |

The offline-checkout and price-change rows are the ones that matter. They are
the two ways a service worker can quietly undo the guarantees in
[ARCHITECTURE.md §5](./ARCHITECTURE.md).
