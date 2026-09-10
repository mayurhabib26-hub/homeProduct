# Roadmap

Phased delivery. Each phase ends with something demonstrable and, where
possible, shippable.

Estimates assume one experienced full-stack developer. Multiply by ~1.5 for
someone learning the stack as they go.

---

## Phase 0 — Groundwork · 1 week

Workspace split, routing, and the fixes that do not need a backend.

- `frontend/` + `backend/` + `shared/` npm workspaces
- react-router with the full route map, `<Link>` everywhere
- **Fix the unreachable product detail page** — a live bug today
- Remove the seeded fake cart and wishlist
- Delete duplicate images and unused dependencies
- Real WhatsApp number replacing the placeholder
- CI: lint, typecheck, build

**Ships to production.** The site is better than it is today, and every
product has a shareable URL.

---

## Phase 1 — Data layer · 1 week

- Drizzle schema, first migration, local Postgres via Docker
- Seed from the existing `products.ts` / `recipes.ts` / `siteData.ts`
- Express skeleton: health, logging, error handling, env validation
- `GET /api/products`, `/api/products/:slug`, `/api/recipes`
- Frontend catalogue pages read from the API
- Images to R2 with responsive derivatives

**Milestone:** the catalogue is data, not code. Changing a price no longer
requires a deploy.

---

## Phase 2 — Orders and payments · 2 weeks

The phase where mistakes cost money. Do not compress it.

- Server-side pricing, coupon, shipping, and tax calculation
- `POST /api/orders` with idempotency
- Stock decrement with the conditional-update guard
- Razorpay: order creation, signature verification, webhook
- Real checkout replacing the simulated one
- COD path
- Confirmation page and guest order tracking
- Reconciliation job
- **Concurrency test in CI**

**Milestone: you can take money.** Combined with Phase 6, this is the minimum
viable launch.

---

## Phase 3 — Admin · 2 weeks

- Auth: bcrypt, JWT cookie, roles, rate limiting, audit log
- Dashboard
- Orders: list, detail, status transitions, tracking, refunds
- Products: CRUD with inline variants and image upload
- Inventory screen
- Coupons, reviews, recipes

**Milestone:** the business runs without a developer.

Until this ships, the catalogue is managed via Drizzle Studio. That is
acceptable for a few weeks and not beyond.

---

## Phase 4 — Fulfilment · 1 week

- Redis + BullMQ, worker processes
- Order confirmation by email and WhatsApp
- Shiprocket: order creation, AWB, tracking updates
- Pincode serviceability and shipping rates
- Shipment notifications

**Milestone:** an order flows from payment to courier without manual steps.

---

## Phase 5 — Compliance · 1 week

Detailed in [COMPLIANCE.md](./COMPLIANCE.md). **Blocks launch.**

- Legal Metrology fields and the product-page declarations block
- `batches` table for manufacture dates
- HSN codes, GST rates confirmed with a CA
- Sequential invoice numbering, CGST/SGST/IGST logic
- Invoice PDF generation, storage, delivery
- All six policy pages
- FSSAI number displayed
- DPDP: consent handling and the erasure action

**Run the registrations in parallel from week 1** — FSSAI takes 2–4 weeks and
gates Razorpay KYC. It is the true critical path.

---

## Phase 6 — Hardening · 1 week

- Redis caching with stampede protection, CDN cache headers
- PgBouncer, read replica
- Rate limiting, CSP, security headers
- Sentry, metrics, alerts, the daily business digest
- Load test including the concurrent-stock scenario
- Backup restore drill

**Milestone:** ready for real traffic, not just working traffic.

---

## Phase 7 — Growth · 1 week, ongoing

- Build-time prerender + edge meta injection for SEO
  ([ARCHITECTURE.md §9](./ARCHITECTURE.md))
- JSON-LD `Product` / `Offer` / `Recipe` schema
- Sitemap, canonical URLs, per-page meta
- GA4 with e-commerce events
- Abandoned cart recovery over WhatsApp
- Accessibility audit against WCAG 2.2 AA

---

## Timeline

```
Week  1  2  3  4  5  6  7  8  9 10
P0    ██
P1       ██
P2          ████
P3               ████
P4                    ██
P5                       ██
P6                          ██
P7                             ██
Registrations ████████████        ← start day 1, runs in parallel
```

**~10 weeks to a fully featured platform.**

**Earliest responsible launch: end of week 7** — Phases 0–2 and 5, plus the
essential parts of 6. Admin work can trail; the database can be managed
directly for a few weeks. Compliance and payment correctness cannot trail.

---

## Sequencing rules

Some orderings are constraints, not preferences:

- **Registrations start on day 1.** They are calendar time you cannot compress
  with effort, and Razorpay KYC gates any real payment.
- **Routing (P0) before anything else.** Every later phase assumes real URLs.
- **Paise migration before real data exists.** Converting rupee floats after
  orders exist means touching financial records.
- **Compliance (P5) before launch, not after.** Retrofitting invoice
  numbering across a live order history is genuinely painful.
- **Admin (P3) can trail the launch.** Nothing else can.

---

## Explicitly deferred

Decisions, not oversights. Revisit when there is evidence, not appetite.

| Deferred | Revisit when |
|---|---|
| Customer accounts and OTP login | Repeat-purchase rate justifies the OTP cost |
| Subscriptions | Customers ask for recurring delivery |
| Multi-language (Kannada UI) | Regional traffic justifies translation upkeep |
| Native app | The mobile web experience is measurably the ceiling |
| Redis stock reservation | The concurrency test shows real contention |
| Warehouse / multi-location inventory | There is more than one kitchen |
| Recommendation engine | Enough order history to make it non-random |
| Loyalty programme | Repeat customers exist to be rewarded |

Each of these is a real feature someone will ask for. The answer is "not yet,
and here is what would change my mind" — which is a better answer than either
"no" or building it.
