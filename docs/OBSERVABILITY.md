# Observability

You cannot fix what you cannot see. This is deliberately small — a monitoring
setup nobody reads is worse than none, because it manufactures confidence.

---

## 1. SLOs

Three. Not thirty.

| SLO | Target | Window | Why |
|---|---|---|---|
| Storefront availability | 99.9% | 30 days | ~43 min/month of downtime |
| Checkout success rate | > 98% of started checkouts that reach a terminal state | 7 days | The number that maps to revenue |
| Catalogue latency | p95 < 400ms | 7 days | Above this, bounce rate climbs |

Checkout success rate is the SLO that matters. Availability can be green while
every payment silently fails signature verification.

---

## 2. Logging

**Structured JSON, one line per event, `pino`.** Never `console.log` — it is
unstructured, unfilterable, and synchronous.

Every log line carries: `requestId`, `route`, `method`, `status`, `durationMs`,
`instanceId`. Order-related lines add `orderNumber`.

### Levels

| Level | Use |
|---|---|
| `error` | Broken and needs a human. Pages if it recurs. |
| `warn` | Handled but suspicious — failed signature, exhausted coupon, rate limit hit |
| `info` | Business events: order created, payment verified, status changed |
| `debug` | Local only. Never enabled in production. |

### Never log

- Phone numbers, addresses, emails, customer names
- Full request bodies on payment or auth routes
- Razorpay key secret, JWTs, session cookies, password hashes
- Anything under DPDP that would turn a log store into a PII breach

**Log the `orderNumber` and look the rest up.** This is the whole discipline:
identifiers in logs, PII in the database.

### Request IDs

Generated per request (ULID), returned in every error response, attached to
every log line and every queue job spawned by that request. A customer with a
`requestId` turns a vague support ticket into a single `grep`.

---

## 3. Metrics

| Metric | Type | Alert |
|---|---|---|
| `http_request_duration` by route | histogram | p95 > 1s for 5 min |
| `http_requests_total` by status | counter | 5xx rate > 1% for 5 min |
| `orders_created_total` by method | counter | zero for 30 min during business hours |
| `payment_verification_failures` | counter | > 5 in 10 min |
| `stock_decrement_conflicts` | counter | Sudden spike = contention |
| `queue_depth` by queue | gauge | > 1,000, or any job older than 15 min |
| `queue_job_failures` | counter | Any job exhausting retries |
| `db_pool_utilisation` | gauge | > 80% |
| `cache_hit_rate` | gauge | < 70% |
| `webhook_processing_lag` | histogram | p95 > 60s |

**`orders_created_total` hitting zero is the alert that catches what nothing
else does.** Every service can be healthy — 200s, low latency, no errors —
while a broken frontend build means nobody can check out. An absence-of-success
alert is the only thing that notices.

---

## 4. Alerts

Two tiers. Anything that pages must be worth waking up for; anything else is
a ticket. Alert fatigue is a real outage cause.

### Page immediately
- Storefront or API down (external check, 2 consecutive failures)
- Postgres primary unreachable
- Payment verification failing repeatedly
- Zero orders for 30 min during business hours
- Disk above 90% on any stateful node

### Ticket, next business day
- Elevated 4xx
- Cache hit rate degraded
- Queue backlog growing but draining
- A read replica lagging
- Low stock on a bestseller
- `npm audit` high severity

### Never alert on
CPU (a symptom, not a problem), memory (Node is expected to use it), or
individual 500s (aggregate rate, not instances).

**External uptime checks from outside your infrastructure.** A monitor running
in the same datacentre as the thing it monitors reports success right up until
the datacentre is the problem.

---

## 5. Error tracking

Sentry (or equivalent) on both sides.

**Frontend:** unhandled exceptions, React error boundaries, failed API calls,
source maps uploaded at build (and not served publicly). Scrub PII from breadcrumbs
before send.

**Backend:** unhandled rejections, 500s, failed jobs after final retry, tagged
with `requestId` and release SHA.

Errors are grouped and **triaged weekly**. An error tracker with 400 unread
issues is a landfill.

---

## 6. Business monitoring

Technical health is not business health. The daily digest emailed to the owner:

- Orders and revenue yesterday, versus the same weekday last week
- Failed payments, with reasons
- Reconciliation result (see [PAYMENTS.md §10](./PAYMENTS.md))
- Low-stock variants
- Orders in `confirmed` for more than 48h — paid but unshipped
- Undelivered notifications

**Send it even when everything is clean.** A report that only arrives on bad
days is indistinguishable from a broken report.

---

## 7. Dashboards

One operational dashboard. If it does not fit on a screen, it is not a
dashboard.

Rows: request rate and error rate · p50/p95/p99 latency · orders per hour ·
queue depth · DB connections and cache hit rate.

Grafana Cloud's free tier is sufficient at this scale. Do not self-host a
monitoring stack for a spice shop — the monitoring becomes the thing that
needs monitoring.

---

## 8. Health endpoints

| Endpoint | Checks | Used by |
|---|---|---|
| `/api/health` | Process alive. **No dependency checks.** | Load balancer liveness |
| `/api/health/ready` | Postgres + Redis reachable | Deploy gating, readiness |

Keeping liveness dependency-free is deliberate: if liveness checked Postgres, a
30-second database blip would cause the load balancer to kill **every** API
instance at once, turning a brief degradation into a full outage that then
cannot recover because the instances keep failing their checks.

---

## 9. Retention

| Data | Retention |
|---|---|
| Application logs | 30 days hot, 90 days cold |
| Metrics | 15 months (year-on-year comparison) |
| Errors | 90 days |
| `audit_log` | Forever — it is business data, not telemetry |
| `webhook_events` | 1 year |
