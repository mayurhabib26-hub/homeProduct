/**
 * Admin API. Every route behind requireAdmin; the dangerous ones behind
 * requireRole('owner'). Every mutation writes to audit_log.
 */
import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { asyncRoute } from '../middleware/error-handler.js';
import { requireAdmin, requireRole } from '../middleware/admin-auth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getDb } from '../db/client.js';
import { orders, orderItems, products, variants, coupons, reviews, auditLog } from '../db/schema.js';
import { transitionOrder, allowedFrom, type OrderStatus } from '../services/order-status.js';
import { refundOrder } from '../services/refunds.js';
import { record } from '../services/admin-auth.js';

export const adminRouter = Router();

adminRouter.use('/admin', requireAdmin);

/* --- dashboard --------------------------------------------------------- */

adminRouter.get(
  '/admin/stats',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const since = (days: number) => new Date(Date.now() - days * 86_400_000);

    const rows = (await db.execute(sql`
      select
        (select count(*)::int from orders where created_at >= ${since(1)}) as orders_today,
        (select coalesce(sum(total_paise),0)::bigint from orders
           where created_at >= ${since(1)} and status not in ('failed','cancelled')) as revenue_today,
        (select coalesce(sum(total_paise),0)::bigint from orders
           where created_at >= ${since(7)} and status not in ('failed','cancelled')) as revenue_week,
        (select count(*)::int from orders where status = 'confirmed') as awaiting_packing,
        (select count(*)::int from variants where stock_qty <= 5 and active) as low_stock,
        (select count(*)::int from orders
           where payment_status = 'failed' and created_at >= ${since(1)}) as failed_payments,
        (select count(*)::int from reviews where approved = false) as pending_reviews
    `)) as unknown as { rows?: Record<string, number>[] } | Record<string, number>[];

    const stats = (Array.isArray(rows) ? rows : (rows.rows ?? []))[0] ?? {};

    // Paid but unshipped for more than 48h — the queue that quietly rots.
    const stuck = await db
      .select({ orderNumber: orders.orderNumber, createdAt: orders.createdAt })
      .from(orders)
      .where(and(eq(orders.status, 'confirmed'), sql`${orders.createdAt} < now() - interval '48 hours'`))
      .limit(20);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: { ...stats, stuckOrders: stuck } });
  }),
);

/* --- orders ------------------------------------------------------------ */

const orderListQuery = z
  .object({
    status: z.string().max(20).optional(),
    phone: z.string().max(20).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(25),
  })
  .strict();

adminRouter.get(
  '/admin/orders',
  asyncRoute(async (req, res) => {
    const parsed = orderListQuery.safeParse(req.query);
    if (!parsed.success) throw badRequest('Invalid filter.');
    const { status, phone, page, limit } = parsed.data;

    const db = getDb();
    const where = [
      status ? eq(orders.status, status) : undefined,
      phone ? eq(orders.phone, phone) : undefined,
    ].filter(Boolean);

    const rows = await db
      .select()
      .from(orders)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: rows.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        customerName: o.customerName,
        city: o.city,
        totalPaise: o.totalPaise,
        createdAt: o.createdAt,
        allowedTransitions: allowedFrom(o.status as OrderStatus),
      })),
      meta: { page, limit },
    });
  }),
);

adminRouter.get(
  '/admin/orders/:orderNumber',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, req.params.orderNumber))
      .limit(1);
    if (!order) throw notFound('No such order.');

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const trail = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'order'), eq(auditLog.entityId, order.orderNumber)))
      .orderBy(desc(auditLog.createdAt))
      .limit(50);

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      data: {
        ...order,
        items,
        allowedTransitions: allowedFrom(order.status as OrderStatus),
        auditTrail: trail,
      },
    });
  }),
);

const statusBody = z
  .object({
    status: z.enum([
      'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'rto', 'returned',
    ]),
    trackingNumber: z.string().max(60).optional(),
    courier: z.string().max(60).optional(),
    restock: z.boolean().optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

adminRouter.patch(
  '/admin/orders/:orderNumber/status',
  asyncRoute(async (req, res) => {
    const parsed = statusBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid status change.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const [before] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, req.params.orderNumber))
      .limit(1);
    if (!before) throw notFound('No such order.');

    // The state machine rejects an illegal transition; the UI hiding the
    // button is only an affordance.
    const result = await transitionOrder(req.params.orderNumber, parsed.data.status, {
      trackingNumber: parsed.data.trackingNumber,
      courier: parsed.data.courier,
      restock: parsed.data.restock,
      adminNote: parsed.data.note,
    });

    await record(
      req.admin!, 'order.status', 'order', req.params.orderNumber,
      { status: before.status }, { status: parsed.data.status }, req.ip,
    );

    res.json({ data: result });
  }),
);

const refundBody = z
  .object({
    amountPaise: z.number().int().positive().optional(),
    restock: z.boolean().optional(),
    reason: z.string().min(3).max(300),
  })
  .strict();

adminRouter.post(
  '/admin/orders/:orderNumber/refund',
  // Owner only: a compromised staff account must not be able to move money.
  requireRole('owner'),
  asyncRoute(async (req, res) => {
    const parsed = refundBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid refund.', parsed.error.flatten().fieldErrors);

    const result = await refundOrder({ orderNumber: req.params.orderNumber, ...parsed.data });
    await record(req.admin!, 'order.refund', 'order', req.params.orderNumber, null, parsed.data, req.ip);

    res.json({ data: result });
  }),
);

/* --- inventory --------------------------------------------------------- */

adminRouter.get(
  '/admin/inventory',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db
      .select({
        variantId: variants.id,
        slug: products.slug,
        productName: products.name,
        weight: variants.weight,
        pricePaise: variants.pricePaise,
        stockQty: variants.stockQty,
        sku: variants.sku,
        active: variants.active,
      })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .orderBy(products.name, variants.pricePaise);

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: rows });
  }),
);

const variantPatch = z
  .object({
    stockQty: z.number().int().min(0).max(100_000).optional(),
    pricePaise: z.number().int().positive().optional(),
    mrpPaise: z.number().int().positive().nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();

adminRouter.patch(
  '/admin/variants/:id',
  asyncRoute(async (req, res) => {
    const parsed = variantPatch.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid change.', parsed.error.flatten().fieldErrors);

    // Repricing moves money, so it is owner-only. Staff may restock.
    const changesPrice = parsed.data.pricePaise !== undefined || parsed.data.mrpPaise !== undefined;
    if (changesPrice && req.admin!.role !== 'owner') {
      throw badRequest('Only an owner can change prices.');
    }

    const db = getDb();
    const id = Number(req.params.id);
    const [before] = await db.select().from(variants).where(eq(variants.id, id)).limit(1);
    if (!before) throw notFound('No such variant.');

    const [after] = await db.update(variants).set(parsed.data).where(eq(variants.id, id)).returning();

    await record(req.admin!, 'variant.update', 'variant', String(id), before, after, req.ip);
    res.json({ data: after });
  }),
);

/* --- coupons ----------------------------------------------------------- */

adminRouter.get(
  '/admin/coupons',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await db.select().from(coupons) });
  }),
);

const couponBody = z
  .object({
    code: z.string().min(3).max(40),
    type: z.enum(['percent', 'flat']),
    value: z.number().int().positive(),
    minOrderPaise: z.number().int().min(0).default(0),
    maxDiscountPaise: z.number().int().positive().nullable().optional(),
    usageLimit: z.number().int().positive().nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();

adminRouter.post(
  '/admin/coupons',
  requireRole('owner'),
  asyncRoute(async (req, res) => {
    const parsed = couponBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid coupon.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const values = {
      ...parsed.data,
      code: parsed.data.code.trim().toUpperCase(),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    };
    const [created] = await db.insert(coupons).values(values).returning();

    await record(req.admin!, 'coupon.create', 'coupon', created.code, null, created, req.ip);
    res.status(201).json({ data: created });
  }),
);

adminRouter.patch(
  '/admin/coupons/:code',
  requireRole('owner'),
  asyncRoute(async (req, res) => {
    const parsed = z.object({ active: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid change.');

    const db = getDb();
    const code = req.params.code.toUpperCase();
    const [after] = await db.update(coupons).set(parsed.data).where(eq(coupons.code, code)).returning();
    if (!after) throw notFound('No such coupon.');

    await record(req.admin!, 'coupon.update', 'coupon', code, null, after, req.ip);
    res.json({ data: after });
  }),
);

/* --- reviews ----------------------------------------------------------- */

adminRouter.get(
  '/admin/reviews',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db
      .select({
        id: reviews.id, name: reviews.name, rating: reviews.rating,
        comment: reviews.comment, approved: reviews.approved,
        createdAt: reviews.createdAt, productName: products.name,
      })
      .from(reviews)
      .innerJoin(products, eq(products.id, reviews.productId))
      .orderBy(reviews.approved, desc(reviews.createdAt));

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: rows });
  }),
);

adminRouter.patch(
  '/admin/reviews/:id',
  asyncRoute(async (req, res) => {
    const parsed = z.object({ approved: z.boolean() }).strict().safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid change.');

    const db = getDb();
    const id = Number(req.params.id);
    const [after] = await db.update(reviews).set(parsed.data).where(eq(reviews.id, id)).returning();
    if (!after) throw notFound('No such review.');

    // Approving changes what the storefront shows, so recompute the
    // denormalised rating rather than letting it drift.
    await db.execute(sql`
      update products p set
        reviews_count = (select count(*) from reviews r where r.product_id = p.id and r.approved),
        rating = coalesce((select round(avg(r.rating)::numeric, 1) from reviews r
                            where r.product_id = p.id and r.approved), 0)
      where p.id = ${after.productId}`);

    await record(req.admin!, 'review.moderate', 'review', String(id), null, after, req.ip);
    res.json({ data: after });
  }),
);

/* --- audit ------------------------------------------------------------- */

adminRouter.get(
  '/admin/audit',
  requireRole('owner'),
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(200);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: rows });
  }),
);
