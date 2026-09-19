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
import { and, desc, eq, ne } from 'drizzle-orm';
import { asyncRoute } from '../middleware/error-handler.js';
import { getDb } from '../db/client.js';
import { orders, orderItems, savedAddresses } from '../db/schema.js';
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

/* ------------------------------------------------------------------ *
 * Saved addresses
 * ------------------------------------------------------------------ */

/**
 * Never written automatically from an order.
 *
 * An address typed once to send a gift to an aunt in Mysore is not somewhere
 * the customer lives, and silently keeping it means their next order defaults
 * to the wrong house. Saving is always an explicit act.
 */
const addressBody = z
  .object({
    label: z.string().max(40).nullable().optional(),
    name: z.string().min(2).max(120),
    phone: z.string().min(6).max(20),
    address: z.string().min(5).max(300),
    landmark: z.string().max(120).nullable().optional(),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(80),
    pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode'),
    isDefault: z.boolean().default(false),
  })
  .strict();

/** Every address route resolves the customer first; none trusts an id alone. */
async function requireCustomer(req: { cookies?: Record<string, string> }) {
  const customer = await customerFromToken(req.cookies?.[CUSTOMER_COOKIE]);
  if (!customer) throw new ApiError(401, 'NOT_AUTHENTICATED', 'Please sign in.');
  return customer;
}

/** Exactly one default. Clearing the others is part of setting one. */
async function clearOtherDefaults(customerId: number, keepId: number) {
  const db = getDb();
  await db
    .update(savedAddresses)
    .set({ isDefault: false })
    .where(and(eq(savedAddresses.customerId, customerId), ne(savedAddresses.id, keepId)));
}

customerAuthRouter.get(
  '/auth/addresses',
  asyncRoute(async (req, res) => {
    const customer = await requireCustomer(req);
    const db = getDb();
    const rows = await db
      .select()
      .from(savedAddresses)
      .where(eq(savedAddresses.customerId, customer.id))
      .orderBy(desc(savedAddresses.isDefault), desc(savedAddresses.createdAt));
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: rows });
  }),
);

customerAuthRouter.post(
  '/auth/addresses',
  asyncRoute(async (req, res) => {
    const customer = await requireCustomer(req);
    const parsed = addressBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the address.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const existing = await db
      .select({ id: savedAddresses.id })
      .from(savedAddresses)
      .where(eq(savedAddresses.customerId, customer.id));

    if (existing.length >= 10) {
      throw new ApiError(422, 'TOO_MANY_ADDRESSES', 'You can save up to 10 addresses.');
    }

    const [created] = await db
      .insert(savedAddresses)
      // The first address saved is the default, whatever the request says —
      // otherwise someone ends up with addresses and no default at all.
      .values({ ...parsed.data, customerId: customer.id, isDefault: parsed.data.isDefault || existing.length === 0 })
      .returning();

    if (created!.isDefault) await clearOtherDefaults(customer.id, created!.id);
    res.status(201).json({ data: created });
  }),
);

customerAuthRouter.patch(
  '/auth/addresses/:id',
  asyncRoute(async (req, res) => {
    const customer = await requireCustomer(req);
    const parsed = addressBody.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the address.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const id = Number(req.params.id);

    // Scoped by customer id, so an id belonging to someone else simply does
    // not exist here — a 404, never a 403 that confirms it is real.
    const [updated] = await db
      .update(savedAddresses)
      .set(parsed.data)
      .where(and(eq(savedAddresses.id, id), eq(savedAddresses.customerId, customer.id)))
      .returning();

    if (!updated) throw new ApiError(404, 'NOT_FOUND', 'No such address.');
    if (updated.isDefault) await clearOtherDefaults(customer.id, updated.id);
    res.json({ data: updated });
  }),
);

customerAuthRouter.delete(
  '/auth/addresses/:id',
  asyncRoute(async (req, res) => {
    const customer = await requireCustomer(req);
    const db = getDb();
    const id = Number(req.params.id);

    const [gone] = await db
      .delete(savedAddresses)
      .where(and(eq(savedAddresses.id, id), eq(savedAddresses.customerId, customer.id)))
      .returning();

    if (!gone) throw new ApiError(404, 'NOT_FOUND', 'No such address.');

    // Deleting the default promotes the next one, so there is never a list
    // with no default.
    if (gone.isDefault) {
      const [next] = await db
        .select({ id: savedAddresses.id })
        .from(savedAddresses)
        .where(eq(savedAddresses.customerId, customer.id))
        .orderBy(desc(savedAddresses.createdAt))
        .limit(1);
      if (next) {
        await db.update(savedAddresses).set({ isDefault: true }).where(eq(savedAddresses.id, next.id));
      }
    }

    res.json({ data: { id } });
  }),
);
