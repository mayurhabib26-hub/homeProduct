# Admin Panel

The interface the business runs on. If this is bad, someone edits the database
by hand at 11pm and the data becomes untrustworthy.

---

## 1. Where it lives

Inside `frontend/`, under `/admin/*`, **lazy-loaded**.

```
frontend/src/pages/admin/
├─ AdminLayout.tsx
├─ LoginPage.tsx
├─ DashboardPage.tsx
├─ OrdersPage.tsx  ·  OrderDetailPage.tsx
├─ ProductsPage.tsx ·  ProductEditPage.tsx
├─ InventoryPage.tsx
├─ CouponsPage.tsx
├─ ReviewsPage.tsx
└─ RecipesPage.tsx
```

**One app, two audiences.** It reuses the Tailwind theme, `cn()`, form
primitives, and the API client — a separate app would duplicate all of it.

The admin route tree is behind `React.lazy`, so **none of this code ships to
customers**. It is a large share of the JavaScript and none of the storefront
audience. Verify with a bundle analyser in CI; a lazy boundary that silently
regresses is easy to miss.

---

## 2. Design brief

The admin panel is a **tool**, not a marketing surface. It inherits the brand
palette so it does not feel like a different product, but the priorities
invert.

| Storefront | Admin |
|---|---|
| Evokes tradition and warmth | Gets a task done in as few clicks as possible |
| Generous whitespace | Dense, scannable tables |
| Motion and reveal on scroll | No animation except state feedback |
| Serif display type | System sans, tabular numerals for money |

Concretely:

- **Tabular numerals** on every amount and quantity. Misaligned digits in a
  money column cause real mistakes.
- **Status is colour + text**, never colour alone. Fails WCAG otherwise, and
  fails anyone reading a printed pick list.
- **Keyboard first.** `/` focuses search, `j`/`k` moves rows, `Enter` opens.
  Order processing is repetitive; a mouse is the slow path.
- **Destructive actions require typed confirmation.** Refunding ₹4,700 asks
  for the order number to be typed, not just an OK button.
- **Optimistic UI, honest rollback.** Marking an order packed updates
  instantly and reverts visibly if the request fails.

Every state must exist: loading skeleton, empty, error with a retry, and
success. An admin table that renders nothing while loading looks broken and
gets refreshed repeatedly.

---

## 3. Roles

| Role | Can |
|---|---|
| `owner` | Everything: refunds, pricing, coupons, staff management, exports |
| `staff` | Orders (view, pack, ship, add tracking), inventory, review moderation |

`staff` **cannot** issue refunds, change prices, create coupons, or export
customer data. This is not distrust; it is limiting the blast radius of a
compromised or mistaken account.

Enforced on the **server**, per route. Hiding a button in the frontend is a
UX affordance, not a permission.

---

## 4. Screens

### 4.1 Login

The only login page in the system. Customers use guest checkout in v1, so
there is no customer authentication until accounts ship
([ROADMAP.md](./ROADMAP.md)).

Seven elements. That is the whole page.

| Element | Notes |
|---|---|
| Email field | `autocomplete="email"` — let password managers fill it |
| Password field | `autocomplete="current-password"` |
| Show/hide password toggle | Cheap, and cuts lockouts from typos on mobile keyboards |
| Submit button | Disabled with a spinner while in flight |
| One generic error line | `role="alert"`, linked by `aria-describedby` |
| Small brand mark | Confirms you are on the right site. Not a hero. |
| TOTP step | Second screen, for `owner`. Required once staff accounts exist. |

#### Deliberately absent

| Omitted | Why |
|---|---|
| **Sign up / register** | Admin accounts are created by the owner. There must be **no public registration route at all** — not hidden, not disabled, not present. |
| **Forgot password** | An email-token reset flow is real attack surface for one or two users. Reset with a CLI script on the server. Add the flow when staff accounts exist and someone is actually locked out. |
| **Remember me** | The session is already 8h sliding. A long-lived token on a panel that can issue refunds is a liability, not a convenience. |
| Social / Google login | Two users. An OAuth dependency to save two seconds. |
| CAPTCHA | Rate limiting and lockout already cover credential stuffing. Add Turnstile only if the logs show it happening. |
| Password strength meter | Nobody creates an account here. |
| Marketing copy, illustrations, "Welcome back" | It is a door, not a landing page. |

#### Behaviour that is not visible

- **Always the same error** — "Invalid email or password". Never "no such
  user". The message must not tell an attacker which half was correct.
- **Run bcrypt even when the email does not exist**, against a dummy hash.
  Otherwise an unknown email returns in 5ms and a known one in 200ms, and the
  response time enumerates your admin accounts.
- **Rate limit** 5 attempts / 15 min / IP, then exponential lockout on the
  account. Show a countdown when locked, not a dead button.
- **Token in an `HttpOnly; Secure; SameSite=Lax` cookie.** Never
  `localStorage` — anything with XSS reads that.
- **`noindex`** on the route, plus a `robots.txt` disallow.
- **Every attempt written to `audit_log`**, success and failure, with IP.
- **Validate the post-login redirect.** If `?next=` is supported, accept only
  relative paths beginning `/admin`. `?next=https://evil.com` is an open
  redirect and a working phishing page.

#### States

Idle · submitting · invalid credentials · rate-limited with countdown ·
awaiting TOTP · server unreachable.

All six render something honest. A spinner that never resolves is how people
end up restarting the server.

#### Design

Centred card, ~380px, on the `#FAF6F0` ground. System sans, not the Cormorant
display face — this is the tool half of the product (§2). Visible focus ring
on both fields, email autofocused on mount, `Enter` submits.

### 4.2 Dashboard

Answers "what needs my attention right now", not "how is the business doing
this quarter".

Top row: revenue today, orders today, pending fulfilment, low-stock count.
Each with a delta versus the same day last week — a number without a baseline
means nothing.

Then:
- **Needs action** — paid but unpacked, oldest first. The primary work queue.
- **Low stock** — variants under threshold, with a direct link to restock.
- Revenue sparkline, 30 days
- Bestsellers, 7 days
- Failed payments in the last 24h (a spike means something is broken)

Backed by a materialised view refreshed every 5 minutes. The dashboard must
never scan `orders` on page load.

### 4.3 Orders — the screen that gets used most

**List:** date, order number, customer, items count, total, payment method,
status. Filter by status, date range, payment method, coupon, pincode. Search
by order number, phone, or name. Default sort: newest first. Default filter:
**needs action** — the queue, not the archive.

Bulk select → mark packed, print pick lists, export.

**Detail:**
- Items with thumbnails, weights, quantities, snapshot prices
- Full totals breakdown including the applied coupon
- Shipping address with a copy button (couriers want it pasted)
- Payment: method, Razorpay id, verification status, signature-verified badge
- **Timeline** — every state change with who and when, from `audit_log`
- Actions gated by the state machine: an order that is not `confirmed` cannot
  be marked `packed`. The UI hides invalid transitions; the server rejects them.
- Print: invoice (GST) and shipping label
- Internal notes, never customer-visible

### 4.4 Products

List with thumbnail, name, category, variant count, price range, total stock,
published toggle.

Editor:
- Core fields, mirroring the current `Product` type
- **Variants inline** — weight, price, MRP, stock, SKU, active. Adding a
  weight is the most common catalogue edit; it must not require a separate
  screen.
- Images: drag-drop → presigned R2 upload → AVIF/WebP derivatives generated
  on the worker. First image is primary; reorder by drag.
- `ingredients[]`, `howToUse[]` as repeatable rows, not comma-separated text.
- Nutrition as a small fixed form.
- HSN code — **required before the product can be published**, because the
  invoice needs it.
- **Preview** opens the real storefront page against a draft.

Deleting soft-deletes. Order history must survive a discontinued product.

### 4.5 Inventory

A dedicated screen because it is edited far more often than product copy.

One table, every variant, editable stock cell. Inline edit, `Tab` between
rows, save on blur. Filters for low stock and out of stock. Bulk adjust
(`+50` to a selection) for a production batch.

Every change writes to `audit_log` with the before and after value. "Where did
40 packets go" must be answerable.

### 4.6 Coupons

Create with code, type, value, min order, max discount, validity window, usage
limit, per-customer limit. List shows usage against limit and revenue
attributed.

Codes are stored uppercase and compared uppercase. This is where the hardcoded
`SVTRADITION` / `WELCOME10` / `TASTEOFHOME` from the current bundle move to.

### 4.7 Reviews

Approval queue, unapproved first. Approve, reject, or reply. Shows whether the
reviewer has a matching order (verified purchase).

Approval recomputes the product's `rating` and `reviews_count`.

### 4.8 Recipes

CRUD over the content currently in `recipes.ts`. Markdown-ish editor for
instructions, paired-product selector, publish toggle.

---

## 5. Security

Detailed in [SECURITY.md](./SECURITY.md); login-specific controls in §4.1.
Admin-wide:

- Session 8 hours, sliding, revocable server-side
- 2FA (TOTP) for `owner` — recommended at launch, **required** once staff
  accounts exist
- `noindex` on all admin routes and a `robots.txt` disallow
- Every mutation writes `audit_log` with admin id, IP, before, after
- Customer data export is `owner`-only and itself audited
- Consider IP allowlisting once the working locations are known — cheap, and
  it removes credential stuffing entirely

---

## 6. What is deliberately not in v1

Named so they are decisions rather than oversights:

- **Analytics beyond the dashboard.** GA4 and the Razorpay dashboard cover it.
  Building a reporting suite is weeks of work to rebuild tools you already have.
- **Multi-warehouse inventory.** One kitchen.
- **Purchase orders / supplier management.** A spreadsheet is genuinely better
  until there are multiple suppliers with lead times.
- **CMS for marketing pages.** The homepage is React. Editing it is a deploy.
  Revisit if copy changes weekly.
- **Bulk product import via CSV.** Eleven products. Add it at ~50.
