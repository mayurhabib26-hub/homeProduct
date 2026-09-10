# API Contract

The HTTP interface between `frontend/` and `backend/`. This document is the
contract — if the code and this file disagree, one of them is a bug.

Base path: `/api` — routed at the CDN edge to the backend origin, same apex
domain as the storefront. No CORS, cookies are `SameSite=Lax`.

---

## 1. Conventions

### Envelope

Success:
```json
{ "data": { }, "meta": { } }
```

Error:
```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 packets of Rasam Powder (250g) remain.",
    "details": { "variantId": 14, "available": 2 }
  },
  "requestId": "01JB8X..."
}
```

`message` is customer-facing and safe to display. `code` is what the frontend
branches on — never parse `message`. `requestId` appears in every log line for
that request; asking a customer for it turns a support ticket into a `grep`.

### Status codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Validation failed (Zod) |
| 401 | Not authenticated |
| 403 | Authenticated, not permitted |
| 404 | Not found |
| 409 | Conflict — out of stock, coupon exhausted, illegal state transition |
| 422 | Well-formed but business-rule rejected |
| 429 | Rate limited (`Retry-After` set) |
| 500 | Bug. Logged, paged, never leaks a stack trace. |
| 503 | Dependency down. `Retry-After` set. |

### Money

Every amount is **integer paise**, and every field says so: `pricePaise`,
`totalPaise`. The API never returns a formatted currency string.

### Validation

Every request body, query string, and path param is parsed with a Zod schema
from `shared/` before a handler runs. Unknown keys are stripped, not ignored.
Failure returns 400 with per-field detail.

### Idempotency

Mutating endpoints accept an `Idempotency-Key` header. The key and its
response are stored in Redis for 24h; a repeat returns the original response
without re-executing. **Required** on `POST /api/orders` — a double-click on
"Place Order" must not create two orders.

### Rate limits

| Scope | Limit |
|---|---|
| Catalogue reads | 300 / min / IP |
| `POST /api/orders` | 10 / min / IP |
| `POST /api/payments/verify` | 20 / min / IP |
| `POST /api/coupons/validate` | 20 / min / IP — brute-force guard |
| `POST /api/admin/login` | 5 / 15 min / IP, then exponential lockout |
| Admin (authenticated) | 600 / min / user |

Counters live in Redis, so limits are global across instances rather than
per-instance.

---

## 2. Catalogue — public, cached

### `GET /api/products`

Query: `category`, `search`, `sort` (`bestselling` \| `price-asc` \|
`price-desc` \| `rating`), `minPricePaise`, `maxPricePaise`, `page`, `limit`
(default 24, max 60).

```json
{
  "data": [{
    "slug": "rasam-powder",
    "name": "Authentic Rasam Powder",
    "regionalName": "ಸಾಂಪ್ರದಾಯಿಕ ರಸಂ ಪುಡಿ",
    "shortDescription": "Warm, aromatic and perfectly balanced…",
    "category": "classics",
    "categoryLabel": "South Indian Classics",
    "badge": "Bestseller",
    "image": "https://cdn.svhomeproducts.com/products/rasam-100.avif",
    "rating": 4.9,
    "reviewsCount": 148,
    "featured": true,
    "variants": [
      { "id": 1, "weight": "100g", "pricePaise": 11000, "mrpPaise": 13000, "inStock": true },
      { "id": 2, "weight": "250g", "pricePaise": 25000, "mrpPaise": 29000, "inStock": true }
    ]
  }],
  "meta": { "total": 11, "page": 1, "limit": 24 }
}
```

`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

**`inStock` is a boolean, not a count.** Exposing exact stock invites
scraping and competitor intelligence, and the number is stale the moment it
is sent. Low-stock urgency ("Only a few left") is derived server-side from a
threshold.

### `GET /api/products/:slug`

Full detail: `about`, `ingredients[]`, `howToUse[]`, `storage`, `nutrition`,
`spiceLevel`, `gallery[]`, approved `reviews` (first 10), and `related[]`
(4 products, same category first).

404 if unpublished. Same cache headers.

### `GET /api/recipes` · `GET /api/recipes/:slug`

Same shape as the current [recipes.ts](../frontend/src/data/recipes.ts),
plus the paired product summary. Cached identically.

### `POST /api/cart/hydrate`

```json
{ "items": [{ "variantId": 1, "quantity": 2 }] }
```

Returns current names, prices, images, and stock for the cart's variant IDs,
plus `unavailable[]` for anything discontinued or out of stock.

**This endpoint exists because the cart stores only IDs.** The browser holds
`{variantId, quantity}` and nothing else; prices always come from the server.
It is why an abandoned cart cannot resurrect a stale price.

Not cached. Rate limited at 60/min/IP.

---

## 3. Coupons

### `POST /api/coupons/validate`

```json
{ "code": "SVTRADITION", "items": [{ "variantId": 1, "quantity": 2 }] }
```

→ `{ "data": { "code": "SVTRADITION", "discountPaise": 5000, "description": "10% off" } }`

Errors: `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_EXHAUSTED`,
`COUPON_MIN_ORDER_NOT_MET`.

This endpoint **previews** a discount. It does not reserve one. The authoritative
computation happens again inside `POST /api/orders` — a coupon can expire in
the seconds between preview and submit, and only the order transaction counts.

Deliberately vague failure messages and a tight rate limit: a fast, chatty
validate endpoint is a coupon-code brute-forcer.

---

## 4. Orders

### `POST /api/orders`

Headers: `Idempotency-Key: <uuid>` (required)

```json
{
  "items": [{ "variantId": 1, "quantity": 2 }],
  "customer": { "name": "…", "phone": "9876543210", "email": "…" },
  "shipping": {
    "address": "…", "landmark": "…",
    "city": "Bengaluru", "state": "Karnataka", "pincode": "560004"
  },
  "couponCode": "SVTRADITION",
  "paymentMethod": "upi",
  "notes": "Please pack the chutney podi separately"
}
```

**No prices in this request. By design.** The server reads current prices from
the database, revalidates the coupon, checks stock, and computes shipping and
tax. A client-supplied price is not merely ignored — sending one is a 400.

Response `201`:
```json
{
  "data": {
    "orderNumber": "SV-2609-04312",
    "totalPaise": 47000,
    "breakdown": { "subtotalPaise": 50000, "discountPaise": 5000, "shippingPaise": 0, "taxPaise": 2000 },
    "payment": { "provider": "razorpay", "razorpayOrderId": "order_Nxxxx", "keyId": "rzp_live_xxx", "amountPaise": 47000 }
  }
}
```

For `paymentMethod: "cod"`, `payment` is `null` and the order is confirmed
immediately.

Errors: `INSUFFICIENT_STOCK` (409, with per-variant availability),
`COUPON_*` (422), `PINCODE_NOT_SERVICEABLE` (422), `CART_EMPTY` (400).

### `GET /api/orders/:orderNumber?phone=9876543210`

Guest order tracking. Requires the phone number that placed the order —
`order_number` alone is not an authenticator.

Returns status, timeline, items, totals, tracking number and courier URL.
Never returns `admin_notes`, full payment identifiers, or the customer email.

Rate limited 10/min/IP. A tracking endpoint that can be enumerated leaks
customer addresses.

---

## 5. Payments

Full flow in [PAYMENTS.md](./PAYMENTS.md).

### `POST /api/payments/verify`

```json
{
  "razorpayOrderId": "order_Nxxxx",
  "razorpayPaymentId": "pay_Nxxxx",
  "razorpaySignature": "9ef4dffb…"
}
```

Server recomputes `HMAC_SHA256(order_id + "|" + payment_id, key_secret)` and
compares in constant time. On match: decrement stock, mark paid, enqueue
confirmation. On mismatch: 400, log at `warn`, **never** mark paid.

Idempotent — safe to call repeatedly. Returns the same result as the webhook.

### `POST /api/webhooks/razorpay`

Called by Razorpay, not the browser.

- Signature verified against the **raw body** before parsing. Express must use
  `express.raw()` on this route — `express.json()` re-serialisation changes
  bytes and breaks the HMAC. This is the single most common way this
  integration is gotten wrong.
- Event written to `webhook_events` first; the unique constraint on `event_id`
  makes duplicate delivery a no-op.
- Always returns 200 once persisted. A non-200 makes Razorpay retry, and
  retrying a *successfully stored* event is pure noise.
- Handles `payment.captured`, `payment.failed`, `refund.processed`,
  `order.paid`.

---

## 6. Admin — authenticated

All routes under `/api/admin/*`. Cookie auth, role checked per route, every
mutation written to `audit_log`. Full spec in [ADMIN.md](./ADMIN.md).

### Auth
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/admin/login` | Sets `HttpOnly; Secure; SameSite=Lax` cookie |
| `POST` | `/api/admin/logout` | |
| `GET` | `/api/admin/me` | Current user + role |

### Orders
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/admin/orders` | Filter by status, date, phone, coupon; paginated |
| `GET` | `/api/admin/orders/:orderNumber` | Full detail incl. payment + audit trail |
| `PATCH` | `/api/admin/orders/:orderNumber/status` | Validated against the state machine |
| `POST` | `/api/admin/orders/:orderNumber/tracking` | AWB + courier; triggers customer notification |
| `POST` | `/api/admin/orders/:orderNumber/refund` | Razorpay refund; `owner` role only |
| `GET` | `/api/admin/orders/:orderNumber/invoice` | Signed R2 URL to the GST PDF |
| `GET` | `/api/admin/orders/export` | CSV for accounting |

### Catalogue
| Method | Path |
|---|---|
| `GET·POST` | `/api/admin/products` |
| `PATCH·DELETE` | `/api/admin/products/:id` |
| `POST` | `/api/admin/products/:id/variants` |
| `PATCH` | `/api/admin/variants/:id` — price, stock, active |
| `POST` | `/api/admin/uploads` — returns a presigned R2 URL |

`DELETE` on a product **soft-deletes** (`published = false`). Order history
must survive a discontinued product.

### Coupons · Reviews · Recipes
Standard CRUD. `PATCH /api/admin/reviews/:id/approve` gates publication.

### Dashboard
`GET /api/admin/stats?period=today|week|month` — revenue, order count, AOV,
bestsellers, low-stock variants, pending-fulfilment count.

Computed from a materialised view refreshed every 5 minutes. Dashboard
aggregates must never scan the whole orders table on page load.

---

## 7. Operational

| Path | Purpose |
|---|---|
| `GET /api/health` | Liveness. No dependency checks — a slow database must not cause the load balancer to kill healthy instances. |
| `GET /api/health/ready` | Readiness. Checks Postgres and Redis. Used for deploy gating, not liveness. |
| `GET /api/version` | Commit SHA and build time. |

The liveness/readiness split matters: conflating them means a brief database
blip terminates every API instance simultaneously, converting a degradation
into an outage.

---

## 8. Versioning

Currently unversioned — one frontend, one backend, deployed by one team.

When a breaking change is needed: add the new field alongside the old, ship the
frontend that reads it, then remove the old field in a later deploy. The same
expand/contract discipline as [DATABASE.md §5](./DATABASE.md).

If a native app or a third-party integration ever consumes this API, introduce
`/api/v2` at that point — not before.
