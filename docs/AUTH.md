# Authentication

Two separate systems with different mechanisms, different threat models, and
different lifetimes. They share only the session-cookie approach.

---

## 1. Two systems

| | Admin | Customer |
|---|---|---|
| Who | 1–3 people, accounts created by the owner | Anyone who has ordered |
| Mechanism | Email + password + TOTP | Phone + OTP, **no password** |
| Identity | Email | Phone number |
| Session | 8 hours, sliding | 30 days |
| Self-registration | **Never** | Implicit on first verified login |
| If compromised | Refunds, pricing, customer export | One customer's order history |
| Exists in v1 | Yes | **No** — guest checkout only |

The asymmetry is deliberate. An admin account can move money, so it gets a
password, a second factor, and a short session. A customer account can view
past orders, so it gets the lowest-friction thing that is still safe.

---

## 2. Sessions

Shared approach for both.

- JWT in an **`HttpOnly; Secure; SameSite=Lax`** cookie. Never `localStorage` —
  a token there is readable by any XSS.
- `SameSite=Lax` is available because the frontend and API share an apex
  domain ([ARCHITECTURE.md §7](./ARCHITECTURE.md)). A separate `api.`
  subdomain would force `SameSite=None` and a worse CSRF posture.
- Short access token, longer refresh token, rotating on use.
- **Refresh tokens are stored server-side**, so a session can actually be
  revoked. A stateless-only design cannot log anyone out.
- Logout deletes the refresh token and clears the cookie.

---

## 3. Admin authentication

Screen specification — fields, omissions, states, design — is in
[ADMIN.md §4.1](./ADMIN.md). The mechanism:

### Password

- **bcrypt, cost 12.** No argument about alternatives; this is fine and boring.
- Accounts are created by the owner through an admin action or a CLI script.
  There is **no public registration route** — not hidden, not disabled, not
  present.
- No self-service password reset in v1. Reset with a CLI script on the
  server. An email-token reset flow is real attack surface for one or two
  users; add it when staff accounts exist and someone is actually locked out.

### Login sequence

```
1. Zod-validate email + password
2. Look up the admin user
3. Run bcrypt — ALWAYS, even when the email does not exist
4. On match: issue tokens, write audit_log, redirect
5. On failure: generic error, write audit_log, increment counter
```

**Step 3 is the one people skip.** Return early on an unknown email and it
answers in 5ms while a known email takes 200ms, which enumerates your admin
accounts by timing alone. Compare against a stored dummy hash instead.

### TOTP second factor

- `otplib` plus any authenticator app. **No provider, no messages, no cost.**
- Recommended for `owner` at launch, **required** once staff accounts exist.
- Separate screen after the password step.
- Recovery codes issued at enrolment, shown once, stored hashed.
- Do **not** use SMS for admin 2FA. SIM-swap is a real attack against the one
  account that can issue refunds.

### Rate limiting and lockout

5 attempts / 15 min / IP, then exponential lockout on the account. Show a
countdown when locked, not a dead button.

### Other

- Generic error always — "Invalid email or password". Never "no such user".
- Every attempt written to `audit_log`, success and failure, with IP.
- `noindex` on all admin routes plus a `robots.txt` disallow.
- **Validate the post-login redirect.** If `?next=` is supported, accept only
  relative paths beginning `/admin`. `?next=https://evil.com` is an open
  redirect and a working phishing page.
- Consider IP allowlisting once the working locations are known. Cheap, and it
  removes credential stuffing entirely.

---

## 4. Customer authentication

**Not in v1.** Guest checkout only — see §7. This section is the design for
when it ships.

### Phone + OTP, no password

| Passwords | Phone OTP |
|---|---|
| Storage, hashing, reset flow, breach exposure | Nothing to store |
| Credential stuffing is constant | Nothing to stuff |
| Nobody remembers one for a spice shop | Every Indian app works this way |
| A second identifier you do not otherwise need | Phone is already collected for delivery |

The phone number is already the natural identity: it is on the order, the
courier needs it, and guest order tracking already authenticates with it
([API.md §4](./API.md)). A password would be a second credential for no gain.

### Flow

```
1. Enter phone (10 digits, +91 fixed prefix)
2. Server: rate-limit → crypto.randomInt 6-digit code
           → store HMAC in Redis, 5-min TTL → send
3. Enter OTP (auto-submit on the sixth digit)
4. Verify: constant-time compare, check expiry and attempt count
5. Create or fetch the customer → session cookie
6. Backfill: link past orders matching that phone
```

Redis is the right store — native TTL means expiry is free and nothing needs
cleaning up. Key `otp:{phone}`, value `{hash, attempts, sentAt}`.

### Screens

**One:** phone field, `+91` fixed prefix, Continue. Nothing else.

**Two:** six digit boxes (or one field with `inputmode="numeric"` and
`autocomplete="one-time-code"` so iOS autofills from SMS), auto-submit on the
sixth digit, resend behind a 30-second countdown, "change number" link.

No password field on either screen.

### Security

- `crypto.randomInt`, never `Math.random`
- Store an **HMAC of the code**, never the code. A Redis dump must not hand
  over live OTPs.
- 5-minute expiry
- **Max 3 verify attempts**, then the code is invalidated entirely
- Max 3 sends/hour and 10/day per phone; a separate IP limit stops someone
  iterating numbers
- Constant-time comparison
- Invalidated on successful use — one code, one login
- Session 30 days. Customer sessions are low-risk, and forcing monthly re-OTP
  is friction for nothing.

### Schema

Already anticipated in [DATABASE.md](./DATABASE.md): `customers`
(`id`, `phone` unique, `name`, `email`, `created_at`) exists, and
`orders.customer_id` is nullable **specifically so this backfill works later**
without a painful migration. Match on phone, link historical orders.

Additions when this ships: `saved_addresses`, and moving the wishlist out of
`localStorage` into a table so it syncs across devices.

---

## 5. OTP delivery

**Primary: WhatsApp via Meta Cloud API (direct). Fallback: MSG91 for SMS.**

### Why WhatsApp first

The WhatsApp Business API is needed anyway for order confirmations and
shipping updates ([ROADMAP.md](./ROADMAP.md) Phase 4), so OTP rides on
infrastructure already built and verified.

It also avoids **DLT registration** entirely, which would otherwise put 1–3
weeks of TRAI paperwork between you and the first delivered code.

Delivery in India is excellent, and the code lands in the same thread as the
customer's order updates — which reads as legitimate rather than as a random
shortcode.

### Why direct rather than a BSP

Resellers (AiSensy, Interakt, WATI, Gupshup) wrap WhatsApp in a dashboard, a
CRM, and campaign tooling for ₹1,000–3,000/month plus a per-message markup.

**We are building our own admin panel.** Their dashboard is the product and it
is the part we do not need. Direct Cloud API means Meta's per-message rate and
nothing else.

The honest trade: direct means handling Meta business verification, template
submission, and webhook wiring yourself. A BSP compresses that into a signup
form. If setup stalls, a BSP for the first few months is reasonable — the
sending code barely changes.

### Why MSG91 as fallback

Not every customer has WhatsApp, and delivery occasionally fails. MSG91 is the
standard Indian transactional SMS provider, and they assist with DLT
registration rather than leaving you to it.

**Start DLT paperwork early even though SMS is the fallback.** It is calendar
time that effort cannot compress, like FSSAI.

### Generate and verify the OTP yourself

MSG91 and most BSPs offer a turnkey "OTP API" that generates, sends, and
verifies for you. **Do not use it.**

Hand that off and the security properties become theirs: how the code is
stored, how many attempts are allowed, whether comparison is constant-time,
when it expires, whether a used code is invalidated. None of it is auditable
and none of it is changeable.

**The provider is a delivery pipe.** Our server generates, stores the HMAC,
counts attempts, and verifies. The provider puts a string in front of a phone.

This is the same principle as server-authoritative pricing and stock — and it
makes the fallback trivial, since swapping WhatsApp for SMS changes only which
function sends the string.

### Setup timeline

| Step | Time |
|---|---|
| Meta Business account + business verification | 2–5 days |
| WhatsApp Business number registered | ~1 day |
| Authentication template submitted and approved | Hours |
| MSG91 account + DLT entity, header, template registration | 1–3 weeks |

Run both in parallel, alongside the FSSAI and GST work. WhatsApp can be live
well before DLT clears.

### Cost

At ~300 orders/month, roughly 500 sends:

| | Per message | Monthly |
|---|---|---|
| WhatsApp authentication template | ~₹0.12–0.30 | ₹60–150 |
| SMS via MSG91 | ~₹0.15–0.20 | ₹75–100 |

**About ₹100/month either way.** Verify current rates — Meta has repriced
authentication messages more than once.

Do not optimise for per-message cost at this volume. Optimise for setup time
and delivery reliability.

### Fallback logic

```
send via WhatsApp
  → delivery webhook confirms within 20s?   done
  → otherwise offer "Send by SMS instead"
```

Customer-triggered, not automatic. An automatic dual-send doubles cost and
doubles the abuse surface for nothing.

---

## 6. SMS pumping

The attack that costs real money, and the reason the rate limits in §4 are not
optional.

An attacker triggers thousands of OTP sends to premium-rate numbers they
control and collects the carrier revenue share. Your bill, their income. It is
automated, and this endpoint is exactly what it targets.

Defences:

- The per-phone and per-IP send limits in §4
- A **hard daily spend cap** at the provider
- Blocking implausible number ranges
- **Alert on OTP-sends per successful-login.** Healthy is ~1.2. If that ratio
  reaches 40, you are being farmed — see
  [OBSERVABILITY.md](./OBSERVABILITY.md).

---

## 7. Guest checkout stays

Permanently. Forcing login before purchase is one of the most reliable ways to
lose conversions, and most Indian D2C food orders are guest orders.

Accounts are an option, never a gate. What they add: order history, saved
addresses, one-tap reorder, a synced wishlist, prefilled checkout.

Guest order tracking already works without any account —
`GET /api/orders/:orderNumber` with the matching phone
([API.md §4](./API.md)).

---

## 8. When to build customer auth

Deferred in [ROADMAP.md](./ROADMAP.md), and the trigger is probably not
"customers ask for accounts".

**COD returns are the likelier trigger.** [PAYMENTS.md §8](./PAYMENTS.md)
recommends OTP verification before accepting a COD order, because RTO costs
roughly nine points of margin. That needs the *same* OTP infrastructure.

So the honest sequencing: build OTP when COD RTO justifies it, then add login
as a thin layer over it. Two problems, one piece of infrastructure.

---

## 9. What we deliberately do not do

| Not doing | Why |
|---|---|
| Customer passwords | Nothing to store is better than something to protect |
| Social / OAuth login | A dependency and a privacy question, to save two seconds |
| SMS 2FA for admin | SIM-swap against the one account that can issue refunds |
| Public admin registration | Accounts are created by the owner. The route should not exist. |
| Magic links by email | Email is not the identity here; phone is |
| Turnkey provider OTP APIs | The security properties would not be ours |
| CAPTCHA on login | Rate limiting covers it. Add Turnstile only if logs show otherwise. |
| Biometric / passkeys | Genuinely good, and worth revisiting once customer accounts exist and there is a reason |
