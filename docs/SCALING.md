# Scaling Playbook

What breaks first, in what order, and what to do about it.

---

## 1. Capacity model

Estimates, with assumptions stated so you can correct them with real data
rather than argue about them.

**Assumptions**

- A browsing session is ~12 page views over ~4 minutes
- Catalogue reads outnumber writes roughly 5,000 : 1
- Conversion 2% — 100 sessions produce ~2 orders
- An order is ~8 API calls (cart hydration, coupon check, create, verify, poll)
- Peak-to-average ratio 10:1 — an Instagram post or festival campaign is the
  real load event, not steady state

**Derived, per stage**

| Stage | API instances | RPS sustained | Concurrent browsers | Orders/min | First bottleneck |
|---|---|---|---|---|---|
| 0 | 1 (shared with DB) | ~50 | ~200 | ~5 | CPU contention with Postgres |
| 1 | 2 × 1vCPU | ~400 | ~2,000 | ~60 | Postgres connections |
| 2 | 4–6 × 2vCPU | ~2,500 | ~10,000 | ~500 | Stock row contention |
| 3 | autoscaled 8–20 | ~10,000 | 50,000+ | ~2,000 | Write throughput on primary |

The concurrent-browser numbers are high relative to RPS because **most
browsing never reaches the origin** — it is served by the CDN. That is the
single largest lever in this entire document.

---

## 2. Bottleneck order

Things fail in a predictable sequence. Fix them in this order; fixing #4
before #1 wastes money.

```
1. Origin bandwidth on images        → CDN + R2 + modern formats
2. Postgres connection exhaustion    → PgBouncer
3. Repeated catalogue queries        → Redis + edge cache
4. Third-party calls in the request  → queue
5. Stock row contention              → short transactions, then Redis reservation
6. Primary write throughput          → replicas for reads, partition orders
```

### 2.1 Images (fixed first, biggest win)

The repository currently ships every product photo **twice** — once in
`public/images/` and once in `src/assets/images/`. Un-optimised JPEGs are by
far the heaviest thing on the page.

- Single source of truth: R2, served through the CDN
- Serve AVIF with WebP fallback, generated on upload
- Responsive `srcset` at 400/800/1600px — a phone must not download a
  1600px hero
- Immutable cache headers on content-hashed filenames
- `loading="lazy"` below the fold, `fetchpriority="high"` on the LCP image

Expect a 60–80% reduction in bytes per page. This costs one afternoon and
improves both cost and Core Web Vitals more than any backend work.

### 2.2 Postgres connections

**This is the one that surprises people.** Every Node instance holds a
connection pool. Ten instances × a pool of 20 = 200 connections. Managed
Postgres tiers commonly cap at 100 or fewer, and each connection costs the
server real memory. You do not get a graceful slowdown — you get
`too many clients already` and a hard outage.

**Fix: PgBouncer in transaction pooling mode.** Hundreds of application
connections multiplex onto ~20 real ones.

Constraints transaction pooling imposes, which the code must respect:

- No session-level state: no `SET` outside a transaction, no `LISTEN/NOTIFY`,
  no session advisory locks (transaction-scoped advisory locks are fine)
- Prepared statements need care — configure the Drizzle/`postgres.js` client
  accordingly
- Keep the app-side pool **small** (5–10 per instance). PgBouncer is doing
  the pooling now; a large app pool defeats it.

Railway Postgres ships no pooler, so at Stage 1 the answer is a **small app
pool** (5–10 per instance) rather than PgBouncer — two instances stay well
inside the connection limit. Add PgBouncer as its own service when the
instance count passes four.

Managed providers (Neon, Supabase) ship a pooled connection string instead,
which makes this a connection-string change rather than an extra service. That
convenience is a large part of what they are worth at Stage 2.

Either way, the constraints above must be respected in the code from the
start — which is why this is documented here rather than discovered at 2am.

### 2.3 Catalogue caching

Three tiers, described in [ARCHITECTURE.md §4.1](./ARCHITECTURE.md).

| Tier | TTL | Invalidation |
|---|---|---|
| CDN edge | `s-maxage=60, stale-while-revalidate=300` | Cache tag purge on admin write |
| Redis | 300s | Version key `INCR` on admin write |
| Postgres replica | — | Source |

**Version-key invalidation, not key deletion.** Cache keys embed a version
(`catalogue:v7:product:rasam-powder`). An admin write does one `INCR` on the
version counter, and every derived key is instantly orphaned. No key
enumeration, no partial invalidation window, no stampede of deletes.

**Stampede protection:** on a Redis miss, take a short lock
(`SET key NX EX 10`) before querying Postgres. Whoever gets the lock fills the
cache; everyone else waits ~50ms and reads the filled value. Without this, a
cache expiry during a traffic spike sends every concurrent request to the
database simultaneously — the classic cache stampede, and the classic way a
site dies at exactly the moment it is succeeding.

### 2.4 Get third parties out of the request path

Never `await` Shiprocket, an SMTP server, WhatsApp, or a PDF renderer inside
an HTTP handler. Their p99 is measured in seconds and their availability is
not yours to control. Enqueue and return.

The rule: **an HTTP handler may talk to Postgres, Redis, and Razorpay. Nothing
else.** Razorpay is the sole exception because order creation genuinely needs
a synchronous response — and it gets a hard 5s timeout with a clear error.

### 2.5 Stock contention

The interesting scaling problem, because it is the one place correctness and
throughput actually conflict.

Under a flash sale, thousands of concurrent buyers hit the *same* variant row.
Row locks serialise them. Throughput on that row is `1 / lock_hold_time`.

**Stage 2 approach — keep the transaction tiny.** Correct and simple:

```
BEGIN
  UPDATE variants SET stock_qty = stock_qty - $qty
    WHERE id = $id AND stock_qty >= $qty          -- guard, not a check-then-act
  -- rowCount = 0 means insufficient stock, roll back
  INSERT order_items ...
COMMIT
```

Hold the lock for milliseconds. No third-party calls, no application logic,
no `SELECT` round trip inside the transaction. Lock variant rows in a
deterministic order (sorted by id) when a cart has several — otherwise two
carts with the same two items in opposite order deadlock.

A single hot row realistically sustains 500–1,500 decrements/second this way.
For a homemade-spice brand that is far beyond any plausible peak.

**Stage 3, only if you genuinely outgrow it — Redis reservation.** `DECRBY`
a Redis counter to reserve stock, hold the reservation 15 minutes, reconcile
to Postgres on payment or expiry. Postgres remains the source of truth and a
reconciliation job corrects drift.

Do not build this pre-emptively. It introduces a second source of stock truth,
and every bug it creates is an oversell — which costs a customer, a refund,
and a review. `ponytail:` the simple version has a known ceiling (~1k
decrements/sec/variant); upgrade only when measured, never when imagined.

### 2.6 Primary write throughput

Last to break, easiest to see coming.

- Route all catalogue reads to a replica; keep **checkout reads on the
  primary** (a replica lagging 200ms will happily sell stock that is gone)
- Partition `orders` and `order_items` by month once past ~5M rows
- Archive orders older than 3 years to cold storage — GST record retention is
  satisfied by the archive, not by the hot table

---

## 3. Frontend scaling

Largely free, because the SPA is static. Still worth being deliberate:

- **Route-level code splitting.** `React.lazy` per route. The admin bundle
  must never ship to customers — it is a large share of the code and none of
  the audience.
- **Budget: < 200KB gzipped** for the initial storefront load. Enforce it in
  CI; a bundle budget that is not enforced is a wish.
- **Split [HomePage.tsx](../frontend/src/pages/HomePage.tsx)** — 1,133 lines
  in one component is both a maintenance and a bundle problem.
- `motion` is tree-shakeable — import specific components, never the whole
  library.
- Prefetch the product route on card hover. Effectively free perceived speed.

---

## 4. Stage-by-stage build order

### Stage 0 — one box (launch)
One Railway service running the API with Postgres alongside, Cloudflare in
front. Fine for the first weeks. ~₹600/mo. **Do not stay here past first real
traffic** — Postgres and Node competing for the same CPU is a bad failure mode.

### Stage 1 — separate the tiers (do this before launch day)
Frontend to Cloudflare Pages. One Railway project with four services — api,
worker, postgres, redis — on private networking, api scaled to two instances.
Images to R2, with hourly database dumps going there too.
**This is the minimum responsible production setup.** ~₹3,000/mo.

### Stage 2 — add the caching and async layers
PgBouncer as a fifth service. A read replica. Workers scaled out. This is
also the point at which managed Postgres (Neon) starts earning its price —
pooling, PITR, and branching without operating them.
Handles any realistic festival or influencer spike. ~₹12,000/mo.

### Stage 3 — autoscale
Horizontal autoscaling on CPU and queue depth. Partitioned orders. Dedicated
queue nodes. Only when Stage 2 is measurably saturated. ~₹45,000/mo.

Nothing in Stage 2 or 3 requires rewriting Stage 1 code. Stateless instances,
server-authoritative pricing, and idempotent writes from day one are what make
that true — they are cheap now and impossible to retrofit later.

---

## 5. Load testing

Do not guess. Before any launch or campaign, run k6 against staging:

| Scenario | Shape | Pass condition |
|---|---|---|
| Catalogue browse | ramp 0→2,000 VUs over 5 min | p95 < 400ms, error rate < 0.1% |
| Checkout burst | 200 concurrent orders on **one variant** | zero oversell, zero deadlocks |
| Cache cold start | flush Redis under load | no stampede, p99 < 2s |
| Instance kill | terminate an API instance mid-test | zero failed requests |

The checkout burst is the one that finds real bugs. Run it with a variant
whose stock is *deliberately* lower than the order count and assert that
exactly `stock_qty` orders succeed. If that number is ever higher, stop and
fix it before anything else in this document.

---

## 6. Cost control

At every stage, in descending order of impact:

1. **Images through the CDN, in modern formats.** Bandwidth is the largest
   variable cost of a photo-heavy storefront.
2. **Cache aggressively.** Every edge hit is a compute cycle and a database
   query you do not pay for.
3. **Right-size Postgres.** This workload is read-heavy and small; buying CPU
   to compensate for a missing index is the expensive way to solve a free
   problem.
4. **Scale workers to zero** outside business hours. Fulfilment jobs can wait.
5. **Watch the ₹ per order.** It is the only number that says whether the
   infrastructure is sized correctly. Track it monthly.
