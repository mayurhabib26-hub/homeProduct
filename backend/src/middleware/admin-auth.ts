/**
 * Admin authorisation.
 *
 * Checked on the server, per route, from the session — never from a
 * request-supplied role or id. Hiding a button in the frontend is a UX
 * affordance, not a permission. See docs/SECURITY.md §3.6.
 */
import type { RequestHandler } from 'express';
import { verifyAccess, type AdminIdentity, type AdminRole } from '../services/admin-auth.js';
import { ApiError } from '../lib/errors.js';
import { env } from '../lib/env.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminIdentity;
    }
  }
}

export const ACCESS_COOKIE = 'sv_admin';
export const REFRESH_COOKIE = 'sv_admin_refresh';

/**
 * HttpOnly so XSS cannot read it; SameSite=Lax because the frontend and API
 * share an apex domain. A separate api. subdomain would force SameSite=None
 * and a worse CSRF posture. See docs/ARCHITECTURE.md §7.
 */
export const cookieOptions = (maxAgeMs: number, secure: boolean) => ({
  httpOnly: true,
  secure,
  /**
   * Still Lax, even though the admin is on another subdomain.
   *
   * SameSite is about the registrable domain, not the origin:
   * admin.example.com -> api.example.com is same-site. Only an unrelated
   * domain would force SameSite=None and a weaker CSRF posture.
   */
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAgeMs,
  /** Set in production so the cookie spans subdomains. */
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    next(new ApiError(401, 'NOT_AUTHENTICATED', 'Please sign in.'));
    return;
  }
  try {
    req.admin = verifyAccess(token);
    next();
  } catch (err) {
    next(err);
  }
};

/** Role gate. `owner` may do anything `staff` may. */
export const requireRole =
  (...roles: AdminRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.admin) {
      next(new ApiError(401, 'NOT_AUTHENTICATED', 'Please sign in.'));
      return;
    }
    if (!roles.includes(req.admin.role)) {
      next(new ApiError(403, 'FORBIDDEN', 'Your account cannot perform that action.'));
      return;
    }
    next();
  };
