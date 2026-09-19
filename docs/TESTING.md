# Testing Strategy

What gets tested, how much, and which tests actually earn their maintenance
cost.

---

## 1. Shape

```
        ╱╲          E2E — 8 to 12 flows
       ╱──╲         Integration — API + real database
      ╱────╲        Unit — pricing, stock, state machine, validation
```

Coverage floor **80%**, enforced in CI. But coverage is a floor, not a goal:
100% coverage of getters proves nothing, and one concurrency test on stock
decrement is worth a hundred component snapshots.

**Where the effort goes:** money and stock. A broken animation is
embarrassing; a broken stock decrement oversells a product and costs a
customer permanently.

---

## 2. Unit tests

Vitest. Backend `services/` and frontend logic.

### Must be tested exhaustively

**Pricing** — the single highest-value test surface.
```
subtotal from variant prices × qty
percent coupon, with and without a max-discount cap
flat coupon larger than the subtotal → never negative
free-shipping threshold, exactly at ₹499 and one paise either side
tax computation and rounding
paise arithmetic — no float anywhere in the path
```

**Stock transitions** — the one function that mutates `stock_qty`.
```
decrement with sufficient stock
decrement with insufficient stock → rejected, unchanged
restore on cancel, on RTO, on refund
never below zero, even when called wrongly
```

**Order state machine** — every legal transition succeeds, every illegal one
throws.

**Validation** — phone, pincode, email, quantity bounds, rejection of unknown
keys.

### Not worth unit testing
Presentational components, Tailwind classes, third-party library behaviour,
trivial getters. These consume maintenance and catch nothing.

---

## 3. Integration tests

Vitest + Supertest against a **real Postgres** in an ephemeral container.

Not a mocked database. Mocks cannot reproduce constraint violations, unique
conflicts, transaction rollback, or lock contention — which is exactly where
the interesting bugs live.

Each test runs in a transaction that is rolled back afterwards: fast, isolated,
no cross-test pollution.

### Coverage

**Order creation**
```
happy path → order created, correct totals
client-supplied price → 400, not silently ignored
insufficient stock → 409, no order, stock unchanged
expired / exhausted coupon → 422
duplicate Idempotency-Key → same response, one order
empty cart → 400
```

**Payments** (Razorpay mocked at the HTTP boundary)
```
valid signature → confirmed, stock decremented, jobs enqueued
invalid signature → 400, order still pending, stock untouched
webhook delivered twice → processed once
webhook before callback → callback is a no-op
amount mismatch → flagged, not fulfilled
```

**Admin auth**
```
valid login → cookie set
wrong password → 401, generic message
6th attempt in 15 min → 429
staff attempting a refund → 403
expired token → 401
```

### The concurrency test

The most valuable test in the suite:

```
Given a variant with stock_qty = 50
When 200 order requests arrive concurrently
Then exactly 50 succeed, 150 return 409,
     final stock_qty = 0, and no deadlock occurred
```

Run it in CI on every push. If it ever reports 51, everything else stops until
it is fixed. This test is the difference between believing the stock logic is
correct and knowing it.

**A pass on PGlite is not a pass.** PGlite is genuinely Postgres, but it runs
in one process on one connection: requests interleave without ever contending
for a row lock, so it proves the guard's arithmetic and cannot surface a
deadlock from inconsistent lock ordering.

There is no Docker on every machine, so the real run goes through
`embedded-postgres`, which downloads the official binaries and starts an actual
multi-process server on an ephemeral port:

```bash
npm run test:real
```

`backend/scripts/with-postgres.mjs` boots the cluster, hands the child a
`DATABASE_URL`, and removes the data directory afterwards. The pool is
`max: 10`, so 200 transactions genuinely queue on real row locks.

**Result, 19 September 2026, PostgreSQL 18.4:**

```
engine=postgres  attempts=200  stock=50
  succeeded=50  sold-out=150  other-failures=0  remaining=0
```

Exactly 50 of 200, stock landed on zero, no deadlocks. The full backend suite
was run against the same real cluster at the same time and passed in full, so
PGlite had not been hiding anything.

---

## 4. E2E tests

Playwright against staging. Deliberately few — E2E tests are slow, flaky, and
expensive to maintain. Only the flows where a break means lost revenue.

| # | Flow |
|---|---|
| 1 | Browse → filter by category → open product → add to cart → cart shows correct total |
| 2 | Full checkout with Razorpay test UPI → confirmation → order in admin |
| 3 | COD checkout → confirmed immediately |
| 4 | Apply coupon → discount reflected → invalid coupon → error |
| 5 | Cart survives reload with correct hydrated prices |
| 6 | Admin login → find order → mark packed → add tracking |
| 7 | Admin edits price → storefront reflects it after cache TTL |
| 8 | Guest order tracking with order number + phone |
| 9 | Mobile 375px: complete a checkout end to end |
| 10 | Keyboard-only: browse → add to cart → checkout, focus visible throughout |

Flows 9 and 10 are not optional. Most traffic is mobile, and flow 10 is the
accessibility floor from the project standards — an untested keyboard path
regresses within two sprints.

**Flaky tests get quarantined the same day.** A suite people ignore because
"that one always fails" provides no signal at all.

---

## 5. Frontend testing

React Testing Library, on behaviour rather than implementation.

Worth testing: cart add/remove/quantity, checkout form validation and error
display, coupon apply/remove, empty and error states, loading states.

Not worth testing: that a component renders a class name, snapshot tests of
markup (they break on every design change and are approved without reading),
`motion` animations.

---

## 6. Accessibility testing

Per the project standards, WCAG 2.2 AA is a floor.

- `axe-core` in Playwright on every E2E route — zero violations to pass
- Manual keyboard pass on the checkout flow each release
- Contrast verified against the **rendered** background, not the token value
- 375px and 1280px in CI screenshots
- `prefers-reduced-motion` respected — verified, given how much `motion` this
  codebase uses

---

## 7. Load testing

k6 against staging before launch and before any campaign. Scenarios and pass
conditions in [SCALING.md §5](./SCALING.md).

---

## 8. What CI runs

| Stage | Runs on | Time |
|---|---|---|
| Lint + typecheck | Every push | ~30s |
| Unit | Every push | ~1 min |
| Integration + concurrency | Every push | ~3 min |
| Bundle budget + audit | Every push | ~30s |
| E2E | PRs to `main`, and staging | ~5 min |
| Load | Manual, pre-launch | ~15 min |

Under 5 minutes for the per-push path. Beyond that, people stop waiting for it
and start merging on hope.

---

## 9. Practice

**TDD where the rules are subtle** — pricing, stock, state transitions. Write
the failing test, watch it fail (a test that has never failed proves nothing),
implement, refactor.

**Test-after is acceptable** for UI and glue code.

**Every bug fix starts with a failing test** that reproduces it. This is the
only mechanism that reliably prevents regressions, and it is how a suite
accumulates value in proportion to the pain already suffered.

**Never** weaken an assertion to make a test pass, mark a flaky test skipped
without a ticket, or test against live Razorpay keys.
