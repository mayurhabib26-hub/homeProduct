/**
 * Rate limits. Table in docs/API.md §1.
 *
 * In-memory for now, which means per-instance rather than global. That is
 * honest at one or two instances; from Stage 2 these must move to a Redis
 * store or the effective limit silently multiplies by the instance count.
 * See docs/SCALING.md §2.
 */
import rateLimit, { type Options } from 'express-rate-limit';

const shared: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
  },
};

export const catalogueLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 300 });

export const orderLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 10 });

export const paymentLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 20 });

/**
 * Tight, because a fast and chatty validate endpoint is a coupon-code
 * brute-forcer.
 */
export const couponLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 20 });

/** Order tracking: an enumerable endpoint leaks customer addresses. */
export const trackingLimiter = rateLimit({ ...shared, windowMs: 60_000, limit: 10 });
