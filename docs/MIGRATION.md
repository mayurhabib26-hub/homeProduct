# Migration

Turning the current single-folder Vite app into the `frontend/` + `backend/` +
`shared/` workspace described in these documents.

Nothing here is a rewrite. The React components, the design, and the copy all
survive. What changes is where data comes from and how navigation works.

---

## 1. Starting point

```
homeProduct/
├─ src/            # React SPA, ~6,900 lines
├─ public/images/  # product photos
├─ index.html  vite.config.ts  package.json  tsconfig.json
```

A static storefront with a simulated shop: hardcoded catalogue, `localStorage`
cart, a `useState` string standing in for a router, and a checkout that
generates a random order number and shows a success page without taking money.

---

## 2. Target

```
homeProduct/
├─ frontend/   ├─ backend/   ├─ shared/   ├─ docs/   └─ package.json
```

npm workspaces at the root. No Turborepo, no pnpm, no Nx — npm already
supports this and the repo has three packages, not thirty.

---

## 3. Step 1 — split the folders

Pure file movement, no code changes beyond paths. Do it as one commit so the
diff is reviewable as a move.

```
src/            → frontend/src/
public/         → frontend/public/
index.html      → frontend/index.html
vite.config.ts  → frontend/vite.config.ts
src/types.ts    → shared/src/types.ts
```

Then:

- Root `package.json` becomes workspaces-only — no dependencies, only scripts
  (`dev`, `build`, `test` fanning out to the workspaces)
- `frontend/package.json` keeps React, Vite, Tailwind, `motion`,
  `lucide-react`
- `shared/package.json` — types and Zod only
- `backend/package.json` — created empty in this step, filled in step 4
- Each workspace gets its own `tsconfig.json` extending a root base

**Cleanups to fold in while everything is moving anyway:**

- Delete `src/assets/images/` — every file is a byte-identical duplicate of
  `public/images/`
- Remove `@google/genai` (zero imports), `autoprefixer` (Tailwind v4 does not
  use it), `esbuild` (Vite's own)
- Strip the AI Studio HMR block from `vite.config.ts`
- Replace `GEMINI_API_KEY` and `APP_URL` in `.env.example` with the real
  variable names from [DEPLOYMENT.md §5](./DEPLOYMENT.md)

Verify: `npm run dev -w frontend` serves the site exactly as before.

---

## 4. Step 2 — routing

The largest frontend change, and it must come first because everything else
assumes real URLs.

**Today:** `activePage` is a string in `ShopContext`, and
[App.tsx](../frontend/src/App.tsx) renders a `switch` on it.

**There is a live bug here.** `navigateToProduct` sets `'product-detail'`
([ShopContext.tsx:112](../frontend/src/context/ShopContext.tsx)) while the
switch matches `'product'` ([App.tsx:42](../frontend/src/App.tsx)). Every
product click falls through to `default` and renders the homepage. The product
detail page — 558 lines — is currently unreachable. The routing migration
deletes the class of bug entirely.

**Route map**

| Route | Page |
|---|---|
| `/` | HomePage |
| `/shop` | ShopPage — filters in the query string, so filtered views are shareable |
| `/product/:slug` | ProductDetailPage |
| `/recipes` · `/recipes/:slug` | RecipesPage |
| `/about` · `/contact` | AboutPage · ContactPage |
| `/cart` · `/checkout` | CartPage · CheckoutPage |
| `/order/:orderNumber` | Confirmation |
| `/track` | Guest order lookup |
| `/policies/*` | Compliance pages ([COMPLIANCE.md](./COMPLIANCE.md)) |
| `/admin/*` | Lazy-loaded admin ([ADMIN.md](./ADMIN.md)) |

**Mechanical changes**

- ~35 `setActivePage('x')` call sites → `<Link to="/x">` or `navigate('/x')`.
  Prefer `<Link>` — it renders a real `<a href>`, which crawlers follow,
  middle-click opens, and screen readers announce as a link. A `<button>` that
  navigates is none of those things.
- `navigateToProduct(id)` → `navigate('/product/' + slug)`
- `ProductDetailPage` reads `useParams()` instead of
  `selectedProductId` from context
- `ShopContext` loses `activePage`, `setActivePage`, `navigateToProduct`,
  `navigateToRecipe`, `selectedProductId`, `selectedRecipeId`. It keeps the
  cart and nothing else.
- The `AnimatePresence` page transition in `App.tsx` keys on
  `location.pathname` instead of `activePage` — the animation is preserved
  exactly.
- Add `<ScrollRestoration>`; delete the manual `window.scrollTo` calls
  scattered through the context.

**Fix while here:** `ShopContext` seeds a fake Rasam Powder cart item and two
fake wishlist entries on first visit
([ShopContext.tsx:47](../frontend/src/context/ShopContext.tsx),
[:63](../frontend/src/context/ShopContext.tsx)). Real customers must start
with an empty cart.

---

## 5. Step 3 — extract `shared/`

`src/types.ts` moves to `shared/src/types.ts`, with Zod schemas added
alongside each type. The backend validates requests with the same schema the
frontend validates forms with, so the two cannot drift apart.

Type changes at this point:

- `price: number` → `pricePaise: number` everywhere. Do this now, before there
  is data. Rupee floats are the bug that keeps giving.
- `Product.image` becomes a URL string, not a bundle import — the admin will
  upload images, and a webpack-style import cannot represent that.
- `CartItem` drops the embedded `product: Product` and keeps
  `{ variantId, quantity }`. See step 6.
- Add `inStock: boolean` at the variant level, derived server-side from
  `stock_qty`.

---

## 6. Step 4 — build the backend

New code, nothing to migrate. Order of construction:

1. Express skeleton, health endpoints, logging, error handler, graceful
   shutdown
2. Drizzle schema and first migration ([DATABASE.md](./DATABASE.md))
3. Seed script that reads the existing `products.ts` / `recipes.ts` /
   `siteData.ts` and writes to Postgres
4. Read endpoints: `/api/products`, `/api/products/:slug`, `/api/recipes`
5. Redis caching and cache invalidation
6. Order creation, coupons, Razorpay ([PAYMENTS.md](./PAYMENTS.md))
7. Admin routes and auth
8. Queue and workers

The seed script is the bridge between the two worlds: it is what lets you
delete `frontend/src/data/` with confidence that nothing was lost.

---

## 7. Step 5 — frontend reads from the API

Replace the static imports, page by page, verifying each before moving on.

| Before | After |
|---|---|
| `import { PRODUCTS } from '../data/products'` | `useQuery(['products'], api.products.list)` |
| `PRODUCTS.find(p => p.id === selectedProductId)` | `useQuery(['product', slug], …)` |
| `import { RECIPES } from '../data/recipes'` | `useQuery(['recipes'], …)` |
| Client-side coupon check | `POST /api/coupons/validate` |
| Fake order at `CheckoutPage:53` | `POST /api/orders` + Razorpay |

Each page needs states it does not currently have: **loading, empty, and
error**. With a hardcoded array, data is always instantly present. With a
network, it is not. A skeleton on the catalogue and an error with a retry are
not polish here — they are the difference between a slow connection and an
apparently broken site.

Order of migration: ShopPage → ProductDetailPage → HomePage → RecipesPage →
CartPage → CheckoutPage. Checkout last, because it depends on everything else
working.

### The cart change

Today `ShopContext` serialises the **entire product object** into
`localStorage` ([types.ts:41](../shared/src/types.ts)). A cart abandoned in
January still shows January prices in March, and a renamed product keeps its
old name forever.

After: store `{ variantId, quantity }` only, and call `POST /api/cart/hydrate`
on load to fetch current names, prices, images, and availability.

Migration for existing visitors: on first load, detect the old shape, map the
old string ids to variant ids, rewrite, and bump the storage key to
`sv_cart_v2`. If a mapping fails, drop that line rather than showing a stale
price.

---

## 8. Step 6 — deletions

Once the frontend reads from the API and staging is verified:

```
frontend/src/data/products.ts     (520 lines → database)
frontend/src/data/recipes.ts      (179 lines → database)
frontend/src/data/siteData.ts     (177 lines → database)
frontend/src/assets/images/       (duplicate of public/images/)
```

The seed script keeps a copy of this content in `backend/src/db/seed.ts`, so
nothing is lost — and staging gets realistic data forever after.

Also worth splitting at this point:
[HomePage.tsx](../frontend/src/pages/HomePage.tsx), at 1,133 lines, is both a
maintenance problem and a bundle problem.

---

## 9. Order of work, and what is safe to defer

```
1. Folder split + cleanup        ← safe, do first, ship it
2. Routing + bug fixes           ← unblocks everything, ships independently
3. shared/ + paise migration     ← do before any data exists
4. Backend + database            ← the bulk of the work
5. Frontend reads from API       ← page by page, verifiable each step
6. Orders + payments             ← the part where mistakes cost money
7. Admin                         ← can trail the launch by weeks
8. Delete the old data files     ← only after staging verification
```

Steps 1 and 2 are worth shipping to production on their own. They fix a live
bug — the unreachable product page — and they make every product URL
shareable, which is worth having before the backend exists.

**A working WhatsApp order path can carry the business through all of this.**
Replace the `919876543210` placeholder with the real number in step 1 and the
shop can take real orders on day one, while the rest is built properly.

---

## 10. What does not change

Worth stating, because migrations create anxiety that everything is in play:

- Every component in `frontend/src/components/`
- The design: palette, typography, spacing, `motion` transitions
- The page structure and copy
- Tailwind v4 and the theme
- `lucide-react` icons
- The overall look and feel of the site

This is a data-layer and routing migration. The interface a customer sees is
the same one that exists today, minus the bugs.
