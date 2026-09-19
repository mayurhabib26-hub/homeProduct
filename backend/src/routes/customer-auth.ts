/**
 * Customer login. See docs/AUTH.md §4.
 *
 * Two endpoints to get in, one to get out, and a small account surface behind
 * the session. Guest checkout is untouched — an account is an option, never a
 * gate.
 */
import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { desc, eq } from 'drizzle-orm';
import { asyncRoute } from '../middleware/error-handler.js';
import { getDb } from '../db/client.js';
import { orders, orderItems } from '../db/schema.js';
import { badRequest, ApiError } from '../lib/errors.js';
import { env, isProduction } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { sendWhatsAppTemplate, sendWhatsApp, whatsappConfigured } from '../lib/notify.js';
import {
  normalisePhone, requestOtp, verifyOtp, customerFromToken, revokeSession, SESSION_TTL_MS,
} from '../services/customer-auth.js';

export const customerAuthRouter = Router();

export const CUSTOMER_COOKIE = 'sv_customer';

/**
 * A per-IP limit on top of the per-phone quota in the service.
 *
 * The phone quota stops one number being spammed; this stops one machine
 * walking through numbers to find which ones have accounts.
 */
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } },
});

/**
 * Deliver the code.
 *
 * WhatsApp first because that infrastructure exists already for order
 * confirmations; SMS would be the fallback once MSG91 is wired. Unconfigured,
 * the code is logged at warn level in development ONLY and never in
 * production, where logging it would hand any log reader an account.
 */
async function deliver(phone: string, code: string): Promise<{ simulated: boolean }> {
  if (!whatsappConfigured) {
    if (isProduction) {
      throw new ApiError(503, 'OTP_UNAVAILABLE', 'Sign-in is temporarily unavailable. Please try again later.');
    }
    logger.warn({ phone, code }, 'DEV ONLY — OTP not sent, no provider configured');
    return { simulated: true };
  }

  if (env.WHATSAPP_OTP_TEMPLATE) {
    await sendWhatsAppTemplate(phone, env.WHATSAPP_OTP_TEMPLATE, [code]);
  } else {
    // A session-initiated free-text message only works inside a 24-hour
    // window, so this is a fallback for testing, not for production sign-in.
    await sendWhatsApp(phone, `${code} is your S V Home Products sign-in code. It expires in 5 minutes.`);
  }
  return { simulated: false };
}

const phoneBody = z.object({ phone: z.string().min(6).max(20) }).strict();
const verifyBody = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
}).strict();

customerAuthRouter.post(
  '/auth/otp/request',
  otpLimiter,
  asyncRoute(async (req, res) => {
    const parsed = phoneBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Enter a mobile number.');

    const phone = normalisePhone(parsed.data.phone);
    const result = await requestOtp(phone, deliver);
    res.json({ data: result });
  }),
);

customerAuthRouter.post(
  '/auth/otp/verify',
  otpLimiter,
  asyncRoute(async (req, res) => {
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Enter the 6-digit code.', parsed.error.flatten().fieldErrors);

    const phone = normalisePhone(parsed.data.phone);
    const { token, isNew, ordersLinked } = await verifyOtp(phone, parsed.data.code);

    res.cookie(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: SESSION_TTL_MS,
      path: '/',
      ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    });

    res.json({ data: { phone, isNew, ordersLinked } });
  }),
);

customerAuthRouter.post(
  '/auth/logout',
  asyncRoute(async (req, res) => {
    await revokeSession(req.cookies?.[CUSTOMER_COOKIE]);
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
    res.json({ data: { ok: true } });
  }),
);

customerAuthRouter.get(
  '/auth/me',
  asyncRoute(async (req, res) => {
    const customer = await customerFromToken(req.cookies?.[CUSTOMER_COOKIE]);
    if (!customer) {
      res.json({ data: null });
      return;
    }
    res.json({ data: { phone: customer.phone, name: customer.name, email: customer.email } });
  }),
);

/**
 * Order history.
 *
 * Scoped to the session's customer id — never to a phone number from the
 * request, which would let anyone read anyone's orders by typing a number.
 */
customerAuthRouter.get(
  '/auth/orders',
  asyncRoute(async (req, res) => {
    const customer = await customerFromToken(req.cookies?.[CUSTOMER_COOKIE]);
    if (!customer) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Please sign in.');

    const db = getDb();
    const rows = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customer.id))
      .orderBy(desc(orders.createdAt))
      .limit(50);

    const detailed = await Promise.all(
      rows.map(async (o) => {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
        return {
          orderNumber: o.orderNumber,
          status: o.status,
          paymentStatus: o.paymentStatus,
          totalPaise: o.totalPaise,
          createdAt: o.createdAt,
          trackingNumber: o.trackingNumber,
          courier: o.courier,
          items: items.map((i) => ({
            productName: i.productName, weight: i.weight,
            quantity: i.quantity, unitPricePaise: i.unitPricePaise,
          })),
        };
      }),
    );

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: detailed });
  }),
);
