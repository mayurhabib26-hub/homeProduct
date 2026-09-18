/**
 * Environment validation, at boot.
 *
 * A missing secret must crash on startup with a clear message, not surface as
 * a confusing 500 during someone's first checkout. See docs/DEPLOYMENT.md §5.
 */
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Unset falls back to PGlite for local development. */
  DATABASE_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Seconds the CDN may serve a cached catalogue response. */
  CATALOGUE_MAX_AGE: z.coerce.number().int().nonnegative().default(60),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
