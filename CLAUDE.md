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

## Known issues in the current code

Being fixed in Phase 0 ([docs/MIGRATION.md](./docs/MIGRATION.md)):

- `navigateToProduct` sets `'product-detail'` but `App.tsx` matches
  `'product'` — the product detail page is unreachable and falls through to
  the homepage
- `ShopContext` seeds a fake cart item and two fake wishlist entries
- The cart serialises whole product objects into `localStorage`, so prices go
  stale permanently
- Coupon codes are hardcoded in the frontend bundle
- `CheckoutPage` fakes an order with `Math.random()` — no payment, nothing
  persisted
- Every product image exists twice (`public/images/` and `src/assets/images/`)
- `@google/genai` is a dependency with zero imports

## Before you change payment or stock code

Read [docs/PAYMENTS.md](./docs/PAYMENTS.md) fully, and make sure the
concurrency test in [docs/TESTING.md §3](./docs/TESTING.md) still passes. If
it ever reports more orders succeeding than there was stock, stop and fix that
before anything else.
