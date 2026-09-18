import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute } from '../middleware/error-handler.js';
import { badRequest, ApiError } from '../lib/errors.js';
import { env, razorpayConfigured } from '../lib/env.js';
import * as ordersService from '../services/orders.js';
import { recordMarketingConsent } from '../services/consent.js';
import {
  orderLimiter, paymentLimiter, couponLimiter, trackingLimiter,
} from '../middleware/rate-limit.js';
import { settlePayment, verifyCheckoutSignature } from '../services/payments.js';

export const ordersRouter = Router();

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number');
const pincode = z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode');

const createBody = z
  .object({
    items: z
      .array(
        z.object({
          productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
          weight: z.string().max(20),
          quantity: z.number().int().positive().max(99),
        }),
      )
      .min(1)
      .max(50),
    customer: z.object({
      name: z.string().min(2).max(120),
      phone,
      email: z.string().email().max(160).optional(),
    }),
    shipping: z.object({
      address: z.string().min(5).max(300),
      landmark: z.string().max(120).optional(),
      city: z.string().min(2).max(80),
      state: z.string().min(2).max(80),
      pincode,
    }),
    couponCode: z.string().max(40).optional(),
    paymentMethod: z.enum(['upi', 'card', 'netbanking', 'cod']),
    notes: z.string().max(500).optional(),
    /**
     * Separate from the transaction and defaulted false. Consent bundled
     * with placing an order is not consent. See docs/COMPLIANCE.md §6.
     */
    marketingConsent: z.boolean().default(false),
  })
  // .strict() so a client sending prices is rejected, not silently ignored.
  // An unexpected field is a signal, and silently dropping it hides an attack
  // in progress. See docs/SECURITY.md §3.1.
  .strict();

ordersRouter.post(
  '/orders',
  orderLimiter,
  asyncRoute(async (req, res) => {
    const key = req.header('Idempotency-Key');
    if (!key || key.length < 8 || key.length > 200) {
      throw badRequest('An Idempotency-Key header is required.');
    }

    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Please check the details you entered.', parsed.error.flatten().fieldErrors);
    }

    if (parsed.data.paymentMethod !== 'cod' && !razorpayConfigured) {
      throw new ApiError(
        503,
        'ONLINE_PAYMENT_UNAVAILABLE',
        'Online payment is temporarily unavailable. Please choose Cash on Delivery, or order on WhatsApp.',
      );
    }

    const { marketingConsent: consent, ...orderInput } = parsed.data;
    const order = await ordersService.createOrder({ ...orderInput, idempotencyKey: key });

    // Recorded either way, with a timestamp: consent must be demonstrable,
    // and so must its absence.
    await recordMarketingConsent(parsed.data.customer.phone, parsed.data.customer.email, consent, 'checkout', req.ip);

    res.status(201).json({
      data: {
        ...order,
        payment:
          order.paymentMethod === 'cod'
            ? null
            : {
                provider: 'razorpay',
                keyId: env.RAZORPAY_KEY_ID,
                razorpayOrderId: (order as { razorpayOrderId?: string }).razorpayOrderId,
                amountPaise: order.totalPaise,
              },
      },
    });
  }),
);

const couponBody = z
  .object({
    code: z.string().min(2).max(40),
    items: z
      .array(
        z.object({
          productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
          weight: z.string().max(20),
          quantity: z.number().int().positive().max(99),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict();

ordersRouter.post(
  '/coupons/validate',
  couponLimiter,
  asyncRoute(async (req, res) => {
    const parsed = couponBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid coupon request.');

    // Never cached, and deliberately terse on failure: a fast, chatty
    // validate endpoint is a coupon-code brute-forcer.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await ordersService.previewCoupon(parsed.data.code, parsed.data.items) });
  }),
);

const verifyBody = z
  .object({
    razorpayOrderId: z.string().min(4).max(100),
    razorpayPaymentId: z.string().min(4).max(100),
    razorpaySignature: z.string().min(16).max(256),
  })
  .strict();

ordersRouter.post(
  '/payments/verify',
  paymentLimiter,
  asyncRoute(async (req, res) => {
    const parsed = verifyBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid payment confirmation.');
    if (!env.RAZORPAY_KEY_SECRET) throw new ApiError(503, 'ONLINE_PAYMENT_UNAVAILABLE', 'Payments are not configured.');

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

    // Verify before trusting anything. This handler is reachable by anyone.
    if (!verifyCheckoutSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature, env.RAZORPAY_KEY_SECRET)) {
      throw new ApiError(400, 'INVALID_SIGNATURE', 'We could not verify that payment.');
    }

    const result = await settlePayment({
      razorpayOrderId,
      razorpayPaymentId,
      signature: razorpaySignature,
      source: 'callback',
    });

    res.json({ data: result });
  }),
);

const trackQuery = z.object({ phone }).strict();

ordersRouter.get(
  '/orders/:orderNumber',
  trackingLimiter,
  asyncRoute(async (req, res) => {
    const parsed = trackQuery.safeParse(req.query);
    // The order number alone is not an authenticator — without this the
    // endpoint leaks customer addresses to anyone who can enumerate.
    if (!parsed.success) throw badRequest('A phone number is required to view an order.');

    const orderNumber = z.string().regex(/^SV-\d{4}-\d{5}$/).safeParse(req.params.orderNumber);
    if (!orderNumber.success) throw badRequest('Invalid order number.');

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await ordersService.getOrderForCustomer(orderNumber.data, parsed.data.phone) });
  }),
);
