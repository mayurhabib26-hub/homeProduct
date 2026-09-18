# S V Home Products — working notes

Context for AI assistants and new contributors. Read
[docs/README.md](./docs/README.md) for the full picture.

## What this is

A D2C e-commerce platform for a South Indian homemade-food brand. Three npm
workspaces: `frontend/` (Vite React SPA), `backend/` (Express API), `shared/`
(types and Zod schemas).

## Hard rules

Violating any of these is a bug, not a style preference.

1. **The server owns price, stock, and discount.** `POST /api/orders` takes
   variant IDs and quantities. A request containing prices is rejected with a
   400 — not ignored.
2. **Money is integer paise.** `bigint`, column and field names end in
   `_paise` / `Paise`. Never a float, never a decimal string. Format only at
   render time.
3. **One function mutates `stock_qty`.** Every path — order, cancel, refund,
   RTO — goes through it. It uses a conditional update
   (`WHERE stock_qty >= qty`), never check-then-act.
4. **Payment webhooks verify against the raw body.** `express.raw()` on the
   webhook route, mounted before `express.json()`. Constant-time comparison.
5. **Nothing `VITE_`-prefixed is secret.** It ships in the browser bundle.
6. **No PII in logs.** Log `orderNumber` and look the rest up.
7. **`backend/` and `frontend/` never import from each other.** Only from
   `shared/`, which contains no runtime side effects.

## Architecture in one paragraph

Static SPA on the CDN. Stateless Express instances behind a load balancer.
Postgres is the only source of truth; Redis caches the catalogue and runs the
job queues; anything touching a third party (email, WhatsApp, courier, PDF)
goes on a queue and never blocks a response. Full detail in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Where things live

| Concern | Location |
|---|---|
| Business rules | `backend/src/services/` — routes are thin |
| Schema and migrations | `backend/src/db/`, `backend/drizzle/` |
| Types and validation | `shared/src/` |
| Storefront pages | `frontend/src/pages/` |
| Admin | `frontend/src/pages/admin/` — lazy-loaded, must not ship to customers |

## Frontend standards

This project follows the global frontend standards. Specifically:

- Design values come from theme tokens, never raw hex in components
- Conditional classes go through `cn()`, never string interpolation
- Every state exists: loading, empty, error, success. A page that renders
  nothing while fetching looks broken.
- WCAG 2.2 AA is the floor: visible focus, 4.5:1 contrast against the actual
  rendered background, real `<label>` on every control, 44px tap targets,
  `prefers-reduced-motion` respected
- Navigation uses `<Link>`, not a `<button>` with an onClick — crawlers,
  middle-click, and screen readers all depend on a real `<a href>`

## Status

Phases 0-5 are done. The catalogue comes from Postgres, orders are priced
and taken server-side, COD works end to end, the admin panel runs the
business, fulfilment is queued, and GST invoices are issued with gap-free
sequential numbering.

**Three things gate release, and none of them is code:**

1. **No live Razorpay call has ever run.** Signature verification is fully
   tested, but order creation against their API needs keys, which needs KYC.
2. **The concurrency test has never run against a real Postgres.** PGlite is
   single-connection, so it proves the arithmetic and not contention. The
   commands are in the header of `backend/src/services/concurrency.test.ts`.
   A pass on PGlite is not a pass.

3. **Compliance values are not set, and invoicing refuses to run without
   them.** SELLER_ADDRESS, SELLER_GSTIN, FSSAI_LICENCE, GRIEVANCE_OFFICER and
   GRIEVANCE_EMAIL come from real registrations. The policy pages in
   `frontend/src/content/policies.ts` are drafts and need a lawyer's review.
   HSN codes and GST rates need confirming per product with a CA — every
   product is currently seeded at 0910 / 5%, which is a guess.

Local development uses PGlite when `DATABASE_URL` is unset — real Postgres
compiled to WASM, but **single-process**: stop the API before `db:migrate` or
`db:seed`, or the seed writes somewhere the server cannot see.

## Before you change auth code

[AUTH.md](./docs/AUTH.md) is the authority on both systems. Two things that
are easy to get wrong:

- **Run bcrypt even when the admin email does not exist.** Returning early
  enumerates accounts by response time.
- **The OTP provider is a delivery pipe, nothing more.** We generate, store
  the HMAC, count attempts, and verify. Turnkey provider OTP APIs move those
  security properties somewhere we cannot audit them.

## Before you change service worker or cache config

[PWA.md §2](./docs/PWA.md) lists which routes may be cached. Order, payment,
coupon-validation and cart-hydration routes are **network-only** — caching any
of them silently undoes hard rule 1. There is no offline checkout, by design.

## Before you change the seed

`db:seed` refuses to run when orders exist (override with `FORCE_SEED=1`) and
uses DELETE rather than TRUNCATE CASCADE. That is not stylistic: TRUNCATE
CASCADE ignores `ON DELETE SET NULL` and wipes `order_items`, the snapshots
that exist so an invoice survives a product being discontinued. It silently
destroyed order history once already.

Tests resolve variant ids through `db/test-helpers.ts` rather than assuming
id 1 — identity no longer restarts, because restarting it required the
TRUNCATE that caused the problem above.

## Before you change payment or stock code

Read [docs/PAYMENTS.md](./docs/PAYMENTS.md) fully, and make sure the
concurrency test in [docs/TESTING.md §3](./docs/TESTING.md) still passes. If
it ever reports more orders succeeding than there was stock, stop and fix that
before anything else.
