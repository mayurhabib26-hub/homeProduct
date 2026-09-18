import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { asyncRoute } from '../middleware/error-handler.js';
import { badRequest } from '../lib/errors.js';
import { isProduction, env } from '../lib/env.js';
import * as auth from '../services/admin-auth.js';
import {
  ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, requireAdmin,
} from '../middleware/admin-auth.js';

export const adminAuthRouter = Router();

/** Credential stuffing is automated, constant and indiscriminate. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please wait and try again.' },
  },
});

const ACCESS_MS = 15 * 60_000;

const loginBody = z
  .object({ email: z.string().email().max(160), password: z.string().min(8).max(200) })
  .strict();

adminAuthRouter.post(
  '/admin/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    // Deliberately not field-level: telling a caller which half was malformed
    // is a small oracle. See docs/AUTH.md §3.
    if (!parsed.success) throw badRequest('Invalid email or password.');

    const result = await auth.login(parsed.data.email, parsed.data.password, req.ip);

    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOptions(ACCESS_MS, isProduction));
    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOptions(env.ADMIN_SESSION_HOURS * 3600_000, isProduction),
    );
    res.json({ data: { email: result.identity.email, role: result.identity.role } });
  }),
);

adminAuthRouter.post(
  '/admin/refresh',
  asyncRoute(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw badRequest('Please sign in.');

    const result = await auth.refresh(token, req.ip);
    res.cookie(ACCESS_COOKIE, result.accessToken, cookieOptions(ACCESS_MS, isProduction));
    res.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      cookieOptions(env.ADMIN_SESSION_HOURS * 3600_000, isProduction),
    );
    res.json({ data: { email: result.identity.email, role: result.identity.role } });
  }),
);

adminAuthRouter.post(
  '/admin/logout',
  asyncRoute(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await auth.logout(token);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    res.json({ data: { ok: true } });
  }),
);

adminAuthRouter.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ data: { email: req.admin!.email, role: req.admin!.role } });
});
