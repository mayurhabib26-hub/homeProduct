# S V Home Products

Authentic South Indian homemade food products and handcrafted spice powders.

A custom D2C e-commerce platform: React storefront, Express API, PostgreSQL,
Razorpay payments, and an admin panel the business runs on.

---

## Status

Currently a **static storefront** — hardcoded catalogue, simulated checkout.
Being converted into a full commerce platform. See
[docs/ROADMAP.md](./docs/ROADMAP.md) for the phased plan and
[docs/MIGRATION.md](./docs/MIGRATION.md) for what changes.

## Stack

Vite · React 19 · TypeScript · Tailwind v4 · `motion` · `lucide-react` ·
Express · PostgreSQL · Drizzle ORM · Redis · Razorpay · Cloudflare

## Layout

```
frontend/   React SPA — static build, served from the CDN
backend/    Express API — stateless Node service
shared/     Types and Zod schemas used by both
docs/       Architecture and operating manual
```

Frontend and backend are separate npm workspaces with independent deploys.
They share only `shared/` and the HTTP contract in
[docs/API.md](./docs/API.md).

## Getting started

```bash
npm install
npm run db:migrate -w backend
npm run db:seed -w backend
npm run dev
```

Frontend on :5173, API on :4000. Vite proxies `/api` to the backend, so
development uses the same relative URLs as production.

No database to install: with `DATABASE_URL` unset the backend uses PGlite —
Postgres compiled to WASM, running in-process. It is the real engine, but it
is **single-process**, so stop the API before running `db:migrate` or
`db:seed`.

To develop against the same server production runs, `docker compose up -d`
and set `DATABASE_URL=postgres://sv:sv@localhost:5432/sv_dev`. The same
migrations apply either way.

## Documentation

Start with [docs/README.md](./docs/README.md) — it indexes everything and
gives a reading order.

The four to read before writing code that touches money:
[ARCHITECTURE](./docs/ARCHITECTURE.md) ·
[DATABASE](./docs/DATABASE.md) ·
[PAYMENTS](./docs/PAYMENTS.md) ·
[SECURITY](./docs/SECURITY.md)

## Rules that are not negotiable

1. The server owns price, stock, and discount. The browser never sends a price.
2. Money is integer paise. Never a float.
3. Every write is idempotent or guarded by a unique constraint.
4. API instances are stateless. No local files, no in-memory sessions.
5. Nothing that talks to a third party blocks an HTTP response.

Rationale for each is in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
