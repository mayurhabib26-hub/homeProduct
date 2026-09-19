/**
 * Environment validation, at boot.
 *
 * A missing secret must crash on startup with a clear message, not surface as
 * a confusing 500 during someone's first checkout. See docs/DEPLOYMENT.md §5.
 */
import 'dotenv/config';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';

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

  /**
   * Admin session signing. Required in production — a default here would be
   * a published secret, which is worse than no secret at all.
   */
  JWT_SECRET: z.string().min(32).optional(),
  ADMIN_SESSION_HOURS: z.coerce.number().int().positive().default(8),

  /**
   * Origins allowed to call the API with credentials. Comma-separated.
   *
   * The admin runs on its own subdomain, so it is cross-origin. This is an
   * explicit allowlist and never a wildcard — '*' is not even legal with
   * credentials, and a reflected origin would let any site drive an
   * authenticated admin session.
   */
  ADMIN_ORIGIN: z.string().default('http://localhost:5174'),

  /**
   * Cookie domain, e.g. '.svhomeproducts.com', so the session reaches both
   * admin.<domain> and api.<domain>.
   *
   * Unset means a host-only cookie, which is correct for localhost —
   * browsers reject domain cookies for it.
   */
  COOKIE_DOMAIN: z.string().optional(),

  /** Cloudflare R2 for product images. Unset falls back to local disk (dev only). */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  /** WhatsApp Cloud API, direct. Unset logs instead of sending. */
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  /**
   * Meta-approved template name for the abandoned-cart reminder, registered
   * under MARKETING. Unset means no reminders go out — a promotional message
   * without a registered template is not something to send by accident.
   */
  WHATSAPP_CART_TEMPLATE: z.string().optional(),

  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  /** Shiprocket. Unset means shipments are recorded but not booked. */
  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  PICKUP_PINCODE: z.string().regex(/^\d{6}$/).default('560004'),

  /** How many jobs a worker takes at once. */
  WORKER_CONCURRENCY: z.coerce.number().int().positive().max(20).default(3),

  /**
   * Seller identity on tax invoices and Legal Metrology declarations.
   *
   * These are legal declarations, not configuration niceties. Missing values
   * are reported at boot rather than silently producing a non-compliant
   * invoice. See docs/COMPLIANCE.md.
   */
  SELLER_LEGAL_NAME: z.string().default('S V Home Products'),
  SELLER_ADDRESS: z.string().optional(),
  SELLER_STATE: z.string().default('Karnataka'),
  SELLER_GSTIN: z.string().optional(),
  FSSAI_LICENCE: z.string().optional(),
  GRIEVANCE_OFFICER: z.string().optional(),
  GRIEVANCE_EMAIL: z.string().optional(),
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

if (isProduction && !env.JWT_SECRET) {
  console.error('[env] JWT_SECRET is required in production. Refusing to start.');
  process.exit(1);
}

/**
 * Development falls back to a random per-boot secret, so sessions simply do
 * not survive a restart. That is the right failure: a hardcoded development
 * secret is one copy-paste away from production.
 */
export const jwtSecret = env.JWT_SECRET ?? randomBytes(48).toString('hex');

/**
 * Compliance values required before a tax invoice can legally be raised.
 * Reported loudly rather than defaulted, because a plausible-looking wrong
 * GSTIN on an invoice is worse than a missing one.
 */
export const missingComplianceValues = (
  [
    ['SELLER_ADDRESS', env.SELLER_ADDRESS],
    ['SELLER_GSTIN', env.SELLER_GSTIN],
    ['FSSAI_LICENCE', env.FSSAI_LICENCE],
    ['GRIEVANCE_OFFICER', env.GRIEVANCE_OFFICER],
    ['GRIEVANCE_EMAIL', env.GRIEVANCE_EMAIL],
  ] as const
).filter(([, v]) => !v).map(([k]) => k);

export const invoicingReady = missingComplianceValues.length === 0;

if (!invoicingReady) {
  console.warn(
    `[compliance] Not set: ${missingComplianceValues.join(', ')}. ` +
      'Invoices cannot be issued until these are configured.',
  );
}
