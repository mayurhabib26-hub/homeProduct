# Security

Threat model and the controls that answer it. Scoped to what actually
threatens a small D2C food business — not a generic OWASP recital.

---

## 1. What we are protecting

| Asset | Impact if compromised |
|---|---|
| Customer PII (name, phone, address) | Legal exposure under the DPDP Act 2023, reputational damage |
| Payment integrity | Direct financial loss — goods shipped for less than cost, or free |
| Admin credentials | Total compromise: prices, refunds, customer export |
| Catalogue integrity | Wrong prices shipped, wrong allergen information published |
| Razorpay key secret | Forged payment signatures — free orders at scale |

**We do not store card data.** Razorpay's hosted checkout means card details
never touch our servers, which removes the entire PCI-DSS scope. This is the
single largest security decision in the system and it is made by *not*
building a custom card form. Never build one.

---

## 2. Realistic threats, in order

1. **Price and discount tampering** — the highest-probability attack, because
   it needs only devtools
2. **Credential stuffing on `/admin`** — automated, constant, indiscriminate
3. **Coupon brute-forcing** — cheap to attempt, directly monetisable
4. **Order enumeration** — scraping customer addresses via the tracking endpoint
5. **Webhook forgery** — marking orders paid without paying
6. **Dependency compromise** — a malicious package in a transitive dependency
7. **XSS via admin-entered content** — product descriptions rendered as HTML

Ranked by likelihood × impact for *this* business. DDoS is absent because
Cloudflare handles it and nobody targets a spice shop.

---

## 3. Controls

### 3.1 Server-authoritative everything

The frontend is a display layer with no authority. It cannot set a price, a
discount, a shipping fee, or a stock level.

- `POST /api/orders` **rejects** a request containing prices — it does not
  ignore them, it 400s. Silent ignoring hides an attack in progress.
- Coupons evaluate server-side. The current client-side codes in the bundle
  ([ShopContext.tsx:181](../frontend/src/context/ShopContext.tsx)) are
  readable by anyone who opens the sources tab, and the discount is editable
  in memory.
- Stock checks happen inside the order transaction, not on the client.

This one principle defeats threat #1 entirely.

### 3.2 Input validation

Zod at every boundary, schemas shared with the frontend from `shared/`.

- `.strict()` — unknown keys are rejected, not stripped. An unexpected field
  is a signal.
- Phone: exactly 10 digits, starting 6–9. Pincode: 6 digits.
- Free text length-capped — `notes` at 500 chars, addresses at 300.
- No handler reads `req.body` directly. It reads the parse result.

### 3.3 SQL injection

Drizzle parameterises everything. The rule: **no string concatenation into
SQL, ever**, including in `sql` template escapes where interpolation must go
through the parameter binding, never through JS template interpolation.

Search uses parameterised `pg_trgm` matching, not `LIKE '%' || userInput || '%'`
built by hand.

### 3.4 XSS

React escapes by default. The risks are the exceptions:

- **`dangerouslySetInnerHTML` is banned in the storefront.** If rich text is
  ever needed for product descriptions, sanitise server-side with a strict
  allowlist on write, not on render.
- Admin-entered content is the untrusted path that people forget — an admin
  account is a foothold, and stored XSS in a product description executes in
  every customer's browser.
- CSP with no `unsafe-inline` for scripts. Razorpay's checkout domain is
  explicitly allowlisted; nothing else is.

### 3.5 Authentication

**Admin:**
- bcrypt, cost 12
- JWT in an `HttpOnly; Secure; SameSite=Lax` cookie. Not `localStorage` —
  a token in `localStorage` is readable by any XSS.
- Access token 15 min, refresh token 8h, rotating. Refresh tokens are stored
  server-side so a session can actually be revoked.
- Rate limit 5 / 15 min / IP, then exponential lockout on the account
- TOTP 2FA for `owner`; required once staff accounts exist
- Generic failure message — "Invalid email or password" never reveals which

**Customers:** guest checkout in v1, so no customer credentials exist to
steal. When phone-OTP login ships: 6-digit code, 5-minute expiry, max 3
verification attempts, max 3 sends per hour per phone, and the code compared
in constant time.

### 3.6 Authorisation

Checked **on the server, per route**, from the session — never from a
request-supplied role or id.

- `staff` cannot refund, reprice, create coupons, or export customer data
- `GET /api/orders/:orderNumber` requires the matching phone number.
  `order_number` alone is not an authenticator (threat #4).
- No endpoint accepts an `adminId` or `role` in its body

### 3.7 Payment security

Covered fully in [PAYMENTS.md](./PAYMENTS.md). The security-critical points:

- Webhook signature verified against the **raw body**, in constant time,
  before the payload is trusted
- Client callback signature verified before an order is marked paid — the
  success handler runs in the customer's browser and is fully attacker-controlled
- Razorpay amount re-checked against the database total before fulfilment
- `razorpay_payment_id` is `UNIQUE`, so replay cannot double-apply

### 3.8 Rate limiting

Redis-backed, so limits are global rather than per-instance. Table in
[API.md §1](./API.md).

The ones that matter: `POST /api/coupons/validate` (brute-force),
`POST /api/admin/login` (credential stuffing), `GET /api/orders/:orderNumber`
(enumeration).

Cloudflare provides a second layer at the edge with bot scoring.

### 3.9 Secrets

- Never in the repository. `.env` is gitignored; `.env.example` carries names
  with empty values.
- Nothing sensitive is `VITE_`-prefixed. **Everything `VITE_` is public** and
  ends up in the JavaScript bundle. This is not obvious to everyone who will
  touch this codebase, which is why it is written here.
- Injected from the host's secret store in production.
- Rotate on any staff departure or suspected exposure.
- Secret scanning in CI on every push.

The existing `.env.example` still references `GEMINI_API_KEY` from the AI
Studio scaffold. Remove it — a dangling secret name invites someone to
populate it.

### 3.10 Headers

Via `helmet`, plus:

```
Content-Security-Policy      default-src 'self'; script-src 'self' checkout.razorpay.com;
                             img-src 'self' data: cdn.svhomeproducts.com;
                             frame-src checkout.razorpay.com; object-src 'none'
Strict-Transport-Security    max-age=31536000; includeSubDomains; preload
X-Content-Type-Options       nosniff
Referrer-Policy              strict-origin-when-cross-origin
Permissions-Policy           camera=(), microphone=(), geolocation=()
```

CSP is the control that turns a stored-XSS bug from a catastrophe into an
inconvenience. Introduce it in report-only mode first, then enforce.

### 3.11 Dependencies

- `npm audit` in CI; build fails on high or critical
- Dependabot or Renovate for patches
- Lockfile committed, `npm ci` in CI — never `npm install` in a pipeline
- **Adding a dependency is a decision that needs a reason.** The current
  `package.json` carries `@google/genai` with zero imports; that is attack
  surface and bundle weight in exchange for nothing.

---

## 4. Privacy — DPDP Act 2023

India's Digital Personal Data Protection Act applies. Practical obligations:

- **Collect the minimum.** Name, phone, address, optionally email. Nothing
  else has a purpose.
- **Stated purpose.** The privacy policy says what is collected and why, in
  plain language.
- **Consent for marketing**, separate from the transaction. A checkbox for
  order updates is not consent for promotions, and it must not be pre-ticked.
- **Deletion on request.** A customer can ask for erasure. Orders must be
  retained for GST (8 years), so the implementation is *anonymisation* —
  strip name, phone, email, address; keep the financial record. Build this as
  an admin action; doing it by hand guarantees mistakes.
- **Breach notification** to the Data Protection Board and affected users.
- **No PII in logs.** Log `orderNumber`, never the phone number or address.
  See [OBSERVABILITY.md](./OBSERVABILITY.md).

---

## 5. Practices

**Pre-commit:** secret scan, lint, typecheck.

**Every PR:** dependency audit, and a security review for anything touching
auth, payments, admin routes, or customer data.

**Quarterly:** rotate secrets, review admin accounts (remove departed staff),
review `audit_log` for anomalies, restore-test a backup.

**Never:**
- Log a full request body on a payment or auth route
- Return a stack trace to a client
- Disable TLS verification "temporarily"
- Test against live Razorpay keys
- Grant `owner` because a permission check is inconvenient

---

## 6. Incident response

1. **Contain.** Revoke sessions, rotate the affected secret, disable the
   compromised account.
2. **Assess.** `audit_log` and request logs — what was accessed, by whom, when.
3. **Preserve.** Snapshot logs before anything rotates them away.
4. **Notify.** If PII was exposed: the Data Protection Board and affected
   customers, per DPDP timelines. If payments: Razorpay immediately.
5. **Fix**, then write it up.

Contacts, escalation, and the on-call rota live in
[DEPLOYMENT.md](./DEPLOYMENT.md). Decide them before you need them.
