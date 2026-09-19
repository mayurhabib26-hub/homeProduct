/**
 * Order creation — the critical path.
 *
 * The request carries variant ids and quantities. It carries no prices. Every
 * amount is read from the database or derived by pricing.ts, because the
 * success handler that would otherwise supply them runs in the customer's
 * browser and is fully attacker-controlled.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, orderItems, variants, products, coupons } from '../db/schema.js';
import { decrementStock, restoreStock, type StockLine } from './stock.js';
import {
  computeTotals, formatOrderNumber, COD_MAX_ORDER_PAISE,
  type CouponRule, type PricedLine,
} from './pricing.js';
import { ApiError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { createRazorpayOrder } from '../lib/razorpay.js';
import { enqueue } from '../lib/queue.js';
import { razorpayConfigured } from '../lib/env.js';
import { markRecovered } from './abandoned-cart.js';

export interface OrderRequestLine {
  productSlug: string;
  weight: string;
  quantity: number;
}

export interface CreateOrderInput {
  items: OrderRequestLine[];
  customer: { name: string; phone: string; email?: string };
  shipping: {
    address: string; landmark?: string; city: string; state: string; pincode: string;
  };
  couponCode?: string;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'cod';
  notes?: string;
  idempotencyKey: string;
}

/** Resolve the cart against the catalogue. This is where prices come from. */
async function priceLines(items: OrderRequestLine[]): Promise<PricedLine[]> {
  const db = getDb();
  const slugs = [...new Set(items.map((i) => i.productSlug))];

  const rows = await db
    .select()
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(
      and(
        inArray(products.slug, slugs),
        eq(products.published, true),
        eq(variants.active, true),
      ),
    );

  return items.map((item) => {
    const row = rows.find(
      (r) => r.products.slug === item.productSlug && r.variants.weight === item.weight,
    );
    if (!row) {
      throw new ApiError(409, 'ITEM_UNAVAILABLE', `${item.productSlug} (${item.weight}) is no longer available.`);
    }
    return {
      variantId: row.variants.id,
      productId: row.products.id,
      productName: row.products.name,
      weight: row.variants.weight,
      sku: row.variants.sku,
      hsnCode: row.products.hsnCode,
      unitPricePaise: row.variants.pricePaise,
      quantity: item.quantity,
      lineTotalPaise: row.variants.pricePaise * item.quantity,
    };
  });
}

/**
 * Validate a coupon at order time.
 *
 * Deliberately re-checked here even though /api/coupons/validate previewed it:
 * a coupon can expire or be exhausted in the seconds between preview and
 * submit, and only this check counts.
 */
async function resolveCoupon(code: string | undefined): Promise<CouponRule | null> {
  if (!code) return null;
  const db = getDb();
  const clean = code.trim().toUpperCase();

  const [row] = await db.select().from(coupons).where(eq(coupons.code, clean)).limit(1);
  if (!row || !row.active) throw new ApiError(422, 'COUPON_NOT_FOUND', 'That coupon code is not valid.');

  const now = new Date();
  if (row.startsAt && row.startsAt > now) throw new ApiError(422, 'COUPON_NOT_STARTED', 'That coupon is not active yet.');
  if (row.expiresAt && row.expiresAt < now) throw new ApiError(422, 'COUPON_EXPIRED', 'That coupon has expired.');
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) {
    throw new ApiError(422, 'COUPON_EXHAUSTED', 'That coupon has been fully claimed.');
  }

  return {
    code: row.code,
    type: row.type,
    value: row.value,
    minOrderPaise: row.minOrderPaise,
    maxDiscountPaise: row.maxDiscountPaise,
  };
}

/**
 * Preview a discount for the cart, without reserving anything.
 *
 * The authoritative computation happens again inside createOrder — a coupon
 * can expire in the seconds between preview and submit, and only the order
 * transaction counts. See docs/API.md §3.
 */
export async function previewCoupon(code: string, items: OrderRequestLine[]) {
  const coupon = await resolveCoupon(code);
  if (!coupon) throw new ApiError(422, 'COUPON_NOT_FOUND', 'That coupon code is not valid.');

  const lines = await priceLines(items);
  const subtotal = lines.reduce((s, l) => s + l.lineTotalPaise, 0);

  if (subtotal < coupon.minOrderPaise) {
    throw new ApiError(
      422,
      'COUPON_MIN_ORDER_NOT_MET',
      `This coupon needs a minimum order of ${formatPaiseForMessage(coupon.minOrderPaise)}.`,
    );
  }

  const { discountPaise } = computeTotals(lines, coupon, 'upi');
  return { code: coupon.code, discountPaise };
}

const formatPaiseForMessage = (p: number) => `₹${Math.round(p / 100)}`;

export async function createOrder(input: CreateOrderInput) {
  const db = getDb();

  // A repeat of the same key returns the original order rather than making a
  // second one. The unique index is the real guarantee; this just makes the
  // common case fast and quiet.
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing) return summarise(existing);

  const lines = await priceLines(input.items);
  if (lines.length === 0) throw new ApiError(400, 'CART_EMPTY', 'Your cart is empty.');

  const coupon = await resolveCoupon(input.couponCode);
  const totals = computeTotals(lines, coupon, input.paymentMethod);

  if (input.paymentMethod === 'cod' && totals.totalPaise > COD_MAX_ORDER_PAISE) {
    throw new ApiError(
      422,
      'COD_LIMIT_EXCEEDED',
      `Cash on Delivery is available up to ₹${COD_MAX_ORDER_PAISE / 100}. Please choose an online payment method for this order.`,
    );
  }

  const stockLines: StockLine[] = lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));

  const created = await db.transaction(async (tx) => {
    // Short transaction on purpose: no third-party calls, no extra round
    // trips. Throughput on a hot variant is 1 / lock_hold_time.
    await decrementStock(tx as unknown as typeof db, stockLines);

    if (coupon) {
      const bumped = await tx.execute(sql`
        update coupons set used_count = used_count + 1
         where code = ${coupon.code}
           and (usage_limit is null or used_count < usage_limit)
      `);
      const affected = (bumped as { rowCount?: number; count?: number }).rowCount
        ?? (bumped as { count?: number }).count ?? 0;
      if (affected !== 1) throw new ApiError(422, 'COUPON_EXHAUSTED', 'That coupon has been fully claimed.');
    }

    const seqRow = (await tx.execute(sql`select nextval('order_number_seq')::int as n`)) as unknown as
      | { rows?: Array<{ n: number }> } | Array<{ n: number }>;
    const rows = Array.isArray(seqRow) ? seqRow : (seqRow.rows ?? []);
    const orderNumber = formatOrderNumber(Number(rows[0]!.n));

    const isCod = input.paymentMethod === 'cod';

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        // COD is accepted immediately; online waits for a verified payment.
        status: isCod ? 'confirmed' : 'pending',
        paymentStatus: 'pending',
        paymentMethod: input.paymentMethod,
        customerName: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email ?? null,
        address: input.shipping.address,
        landmark: input.shipping.landmark ?? null,
        city: input.shipping.city,
        state: input.shipping.state,
        pincode: input.shipping.pincode,
        ...totals,
        couponCode: coupon?.code ?? null,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        weight: l.weight,
        sku: l.sku,
        unitPricePaise: l.unitPricePaise,
        quantity: l.quantity,
        lineTotalPaise: l.lineTotalPaise,
        hsnCode: l.hsnCode,
      })),
    );

    return order;
  });

  logger.info(
    { orderNumber: created.orderNumber, method: created.paymentMethod, totalPaise: created.totalPaise },
    'order created',
  );

  // Enqueued AFTER the transaction commits, never inside it: a rolled-back
  // order must not have sent a confirmation. Deduped so a retry cannot
  // double-send. See docs/ARCHITECTURE.md §4.2.
  if (created.status === 'confirmed') {
    await enqueue('notifications',
      { type: 'order.confirmation', orderNumber: created.orderNumber },
      { dedupeKey: `confirmation:${created.orderNumber}` });

    // COD is invoiceable on confirmation; prepaid waits for settlement.
    await enqueue('documents',
      { type: 'invoice.issue', orderNumber: created.orderNumber },
      { dedupeKey: `invoice:${created.orderNumber}` });
  }

  // Online payment needs a Razorpay order to hand the checkout widget. This
  // happens after the local transaction commits: a provider timeout must not
  // roll back an order we have already taken stock for — the stale-order
  // sweep releases it instead.
  // Closes any open abandoned cart for this number so no reminder goes out
  // about something they have now bought.
  await markRecovered(created.phone, created.orderNumber);

  if (created.paymentMethod !== 'cod' && razorpayConfigured) {
    try {
      const rp = await createRazorpayOrder(created.totalPaise, created.orderNumber);
      await db.update(orders).set({ razorpayOrderId: rp.id }).where(eq(orders.id, created.id));
      return { ...summarise(created), razorpayOrderId: rp.id };
    } catch (err) {
      logger.error({ err, orderNumber: created.orderNumber }, 'could not create razorpay order');
      await failOrder(created.orderNumber, 'razorpay order creation failed');
      throw err;
    }
  }

  return summarise(created);
}

/** Release stock when a payment never completes. */
export async function failOrder(orderNumber: string, reason: string) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || order.status !== 'pending') return;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  await db.transaction(async (tx) => {
    await restoreStock(
      tx as unknown as typeof db,
      items.filter((i) => i.variantId !== null).map((i) => ({ variantId: i.variantId!, quantity: i.quantity })),
    );
    await tx.update(orders)
      .set({ status: 'failed', paymentStatus: 'failed', cancelledAt: new Date() })
      .where(eq(orders.id, order.id));
  });

  logger.warn({ orderNumber, reason }, 'order failed, stock restored');
}

export async function getOrderForCustomer(orderNumber: string, phone: string) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, orderNumber), eq(orders.phone, phone)))
    .limit(1);

  // An order number alone is not an authenticator: without the phone check
  // this endpoint leaks customer addresses to anyone who can enumerate.
  if (!order) throw notFound('No order found with that number and phone.');

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    placedAt: order.createdAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    deliveredAt: order.deliveredAt,
    trackingNumber: order.trackingNumber,
    courier: order.courier,
    shippingCity: order.city,
    shippingState: order.state,
    totals: {
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      taxPaise: order.taxPaise,
      totalPaise: order.totalPaise,
    },
    items: items.map((i) => ({
      name: i.productName, weight: i.weight, quantity: i.quantity,
      unitPricePaise: i.unitPricePaise, lineTotalPaise: i.lineTotalPaise,
    })),
  };
}

function summarise(order: typeof orders.$inferSelect) {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalPaise: order.totalPaise,
    breakdown: {
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      taxPaise: order.taxPaise,
    },
  };
}
