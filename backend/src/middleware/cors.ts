/**
 * CORS for the admin subdomain.
 *
 * The storefront shares an origin with the API (the CDN routes /api/* to this
 * service), so it needs nothing. The admin is on admin.<domain> and does.
 *
 * Strictly allowlisted. A reflected origin would let any site drive an
 * authenticated admin session, and '*' is not legal alongside credentials.
 * See docs/SECURITY.md §3.6.
 */
import type { RequestHandler } from 'express';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const allowed = new Set(
  env.ADMIN_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
);

export const adminCors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Max-Age', '600');
    // Responses differ by Origin, so caches must not share them.
    res.setHeader('Vary', 'Origin');
  } else if (origin && req.path.startsWith('/api/admin')) {
    logger.warn({ origin, path: req.path }, 'admin request from a disallowed origin');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(origin && allowed.has(origin) ? 204 : 403);
    return;
  }

  next();
};
