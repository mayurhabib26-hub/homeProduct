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

  /**
   * Razorpay. Optional so the shop runs COD-only before KYC completes —
   * online payment is refused with a clear message rather than half-working.
   * The key id is public and reaches the browser; the secrets never do.
   */
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
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

/** Online payment is only offered when Razorpay is fully configured. */
export const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

if (isProduction && !razorpayConfigured) {
  console.warn('[env] Razorpay is not configured — the shop will accept COD orders only.');
}
