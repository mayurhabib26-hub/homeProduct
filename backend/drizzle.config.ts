import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Generated migrations are plain SQL and run unchanged on PGlite locally
  // and on Railway Postgres in production. See docs/DATABASE.md §5.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/sv_dev',
  },
});
