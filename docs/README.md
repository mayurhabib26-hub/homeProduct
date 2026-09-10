# S V Home Products — Engineering Documentation

Architecture, contracts, and operating manual for the S V Home Products
e-commerce platform.

## What this is

A custom D2C commerce platform for a South Indian homemade-food brand.
The storefront is an existing React SPA; these documents describe the backend,
data layer, payment flow, admin panel, and the scaling path from a single box
to a horizontally-scaled deployment.

**Stack (fixed, not up for renegotiation):**
Vite · React 19 · TypeScript · Tailwind v4 · `motion` · `lucide-react` ·
Express · PostgreSQL · Drizzle ORM · Redis · Razorpay

## Repository layout

Frontend and backend are **separate, independently deployable workspaces**.
They share nothing but a types package and an HTTP contract.

```
homeProduct/
├─ frontend/            # React SPA — builds to static files, served by CDN
│  ├─ src/
│  ├─ public/
│  ├─ index.html
│  ├─ vite.config.ts
│  └─ package.json
│
├─ backend/             # Express API — stateless Node service
│  ├─ src/
│  ├─ drizzle/          # migrations
│  └─ package.json
│
├─ shared/              # Types + Zod schemas imported by both
│  └─ package.json
│
├─ docs/                # You are here
└─ package.json         # npm workspaces root — scripts only, no app code
```

Rules for the boundary:

- **`backend/` never imports from `frontend/`, and vice versa.** The only
  shared code is `shared/`, and it contains types and validation schemas
  only — no runtime logic, no DB access, no React.
- **They deploy separately.** A frontend change does not redeploy the API.
- **They version their contract in [API.md](./API.md).** Breaking an endpoint
  is a coordinated release, documented there.

## Reading order

Start here if you are new:

| # | Document | What it answers |
|---|---|---|
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | How the system is put together and why |
| 2 | [SCALING.md](./SCALING.md) | How it survives load, and what breaks first |
| 3 | [DATABASE.md](./DATABASE.md) | Schema, indexes, money, migrations |
| 4 | [API.md](./API.md) | Every endpoint contract |
| 5 | [PAYMENTS.md](./PAYMENTS.md) | Razorpay flow, webhooks, reconciliation |
| 6 | [ADMIN.md](./ADMIN.md) | Admin panel specification |
| 7 | [SECURITY.md](./SECURITY.md) | Threat model and controls |
| 8 | [OBSERVABILITY.md](./OBSERVABILITY.md) | Logs, metrics, alerts, SLOs |
| 9 | [DEPLOYMENT.md](./DEPLOYMENT.md) | Environments, CI/CD, runbooks |
| 10 | [TESTING.md](./TESTING.md) | Test strategy and coverage gates |
| 11 | [COMPLIANCE.md](./COMPLIANCE.md) | FSSAI, GST, Legal Metrology, consumer law |
| 12 | [MIGRATION.md](./MIGRATION.md) | What changes in the existing codebase |
| 13 | [ROADMAP.md](./ROADMAP.md) | Phased delivery plan |

## Design principles

These are the rules the rest of the documents follow. When a document
contradicts one of these, the principle wins.

1. **The server owns price, stock, and discount.** The browser is a display
   device. It never tells the server what something costs.
2. **Money is integer paise.** Never a float, never a string with a decimal.
3. **Every write is idempotent or guarded by a unique constraint.** Networks
   retry, users double-click, webhooks fire twice.
4. **Stateless API instances.** No in-memory sessions, no in-memory caches
   holding truth, no local disk writes. Any instance can serve any request.
5. **Reads are cached, writes go to Postgres.** The catalogue is read tens of
   thousands of times per write.
6. **Slow work goes on a queue.** Nothing that talks to a third party (email,
   WhatsApp, courier, PDF) blocks an HTTP response.
7. **Degrade, don't die.** Redis down means slow, not offline. Courier API
   down means orders queue, not fail.

## Conventions

- Timestamps are `timestamptz`, always UTC in storage, IST at render.
- Amounts are `bigint` paise. `₹110.50` → `11050`.
- Public identifiers (`order_number`, product `slug`) are distinct from
  primary keys and are the only IDs that appear in URLs or emails.
- All request bodies are validated with Zod at the route boundary before any
  business logic runs.
