/**
 * Catalogue schema. Orders, coupons and admin land in Phase 2 and 3.
 *
 * Money is bigint paise everywhere — see docs/DATABASE.md §1. Column names
 * carry the unit; a column called `price` in this file is a bug.
 */
import {
  pgTable, bigint, text, boolean, integer, timestamp, jsonb, numeric,
  uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const products = pgTable(
  'products',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** URL identity — /product/rasam-powder. Never the primary key. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    regionalName: text('regional_name'),
    shortDescription: text('short_description').notNull(),
    category: text('category').notNull(),
    categoryLabel: text('category_label').notNull(),
    badge: text('badge'),
    about: text('about').notNull(),
    ingredients: text('ingredients').array().notNull(),
    howToUse: text('how_to_use').array().notNull(),
    storage: text('storage').notNull(),
    nutrition: jsonb('nutrition').notNull(),
    spiceLevel: text('spice_level').notNull(),
    image: text('image').notNull(),
    gallery: text('gallery').array().notNull().default(sql`'{}'`),
    /** Denormalised from reviews: every catalogue card shows them. */
    rating: numeric('rating', { precision: 2, scale: 1 }).notNull().default('0'),
    reviewsCount: integer('reviews_count').notNull().default(0),
    featured: boolean('featured').notNull().default(false),
    isSignature: boolean('is_signature').notNull().default(false),
    /** Unpublished is invisible to the storefront. */
    published: boolean('published').notNull().default(false),
    /** GST classification. Required before a product can be invoiced. */
    hsnCode: text('hsn_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_published_featured_idx').on(t.published, t.featured),
    index('products_category_idx').on(t.category),
  ],
);

export const variants = pgTable(
  'variants',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    weight: text('weight').notNull(),
    pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
    mrpPaise: bigint('mrp_paise', { mode: 'number' }),
    /**
     * The last line of defence against overselling. Even if application logic
     * is wrong, the database refuses. Never drop this to ease a migration.
     */
    stockQty: integer('stock_qty').notNull().default(0),
    sku: text('sku'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('variants_product_weight_idx').on(t.productId, t.weight),
    index('variants_product_idx').on(t.productId),
    check('variants_stock_non_negative', sql`${t.stockQty} >= 0`),
    check('variants_price_positive', sql`${t.pricePaise} > 0`),
  ],
);

export const recipes = pgTable(
  'recipes',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull(),
    prepTime: text('prep_time').notNull(),
    cookTime: text('cook_time').notNull(),
    servings: text('servings').notNull(),
    difficulty: text('difficulty').notNull(),
    image: text('image').notNull(),
    description: text('description').notNull(),
    pairedProductSlug: text('paired_product_slug'),
    ingredients: text('ingredients').array().notNull(),
    instructions: text('instructions').array().notNull(),
    chefTip: text('chef_tip').notNull(),
    published: boolean('published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recipes_slug_idx').on(t.slug)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    location: text('location'),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    productPurchased: text('product_purchased'),
    verified: boolean('verified').notNull().default(false),
    /** Approval-gated: an open review form on food is a spam magnet. */
    approved: boolean('approved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_product_approved_idx').on(t.productId, t.approved),
    check('reviews_rating_range', sql`${t.rating} between 1 and 5`),
  ],
);

/* ------------------------------------------------------------------ *
 * Orders — Phase 2
 * ------------------------------------------------------------------ */

export const coupons = pgTable(
  'coupons',
  {
    /** Stored and compared uppercase. */
    code: text('code').primaryKey(),
    type: text('type').notNull(), // 'percent' | 'flat'
    /** Percent points, or paise for a flat discount. */
    value: integer('value').notNull(),
    minOrderPaise: bigint('min_order_paise', { mode: 'number' }).notNull().default(0),
    /** Caps a percent coupon so 10% off a ₹50,000 order cannot run away. */
    maxDiscountPaise: bigint('max_discount_paise', { mode: 'number' }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    perCustomerLimit: integer('per_customer_limit'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [
    check('coupons_value_positive', sql`${t.value} > 0`),
    check('coupons_used_non_negative', sql`${t.usedCount} >= 0`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** The only order identifier that appears in a URL, email or invoice. */
    orderNumber: text('order_number').notNull(),
    status: text('status').notNull().default('pending'),
    paymentStatus: text('payment_status').notNull().default('pending'),
    paymentMethod: text('payment_method').notNull(),

    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    address: text('address').notNull(),
    landmark: text('landmark'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),

    subtotalPaise: bigint('subtotal_paise', { mode: 'number' }).notNull(),
    discountPaise: bigint('discount_paise', { mode: 'number' }).notNull().default(0),
    shippingPaise: bigint('shipping_paise', { mode: 'number' }).notNull().default(0),
    taxPaise: bigint('tax_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
    couponCode: text('coupon_code'),

    /**
     * Idempotency key from the client. UNIQUE, so a double-clicked "Place
     * Order" or a retried request cannot create a second order — enforced by
     * the database rather than by hoping the application checks first.
     */
    idempotencyKey: text('idempotency_key'),

    razorpayOrderId: text('razorpay_order_id'),
    /**
     * UNIQUE is what makes webhook processing idempotent at the database
     * level rather than only in application logic. Razorpay will deliver the
     * same event twice; the second insert simply fails.
     */
    razorpayPaymentId: text('razorpay_payment_id'),
    razorpaySignature: text('razorpay_signature'),

    trackingNumber: text('tracking_number'),
    courier: text('courier'),
    invoiceUrl: text('invoice_url'),
    notes: text('notes'),
    /** Internal. Never exposed to a customer. */
    adminNotes: text('admin_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('orders_number_idx').on(t.orderNumber),
    uniqueIndex('orders_idempotency_idx').on(t.idempotencyKey),
    uniqueIndex('orders_razorpay_payment_idx').on(t.razorpayPaymentId),
    index('orders_created_idx').on(t.createdAt),
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_phone_idx').on(t.phone),
    check('orders_total_non_negative', sql`${t.totalPaise} >= 0`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /**
     * set null, not cascade: deleting a discontinued product must never
     * delete order history.
     */
    productId: bigint('product_id', { mode: 'number' }).references(() => products.id, {
      onDelete: 'set null',
    }),
    variantId: bigint('variant_id', { mode: 'number' }).references(() => variants.id, {
      onDelete: 'set null',
    }),
    /** Snapshots. Raising a price in 2027 must not alter a 2026 invoice. */
    productName: text('product_name').notNull(),
    weight: text('weight').notNull(),
    sku: text('sku'),
    unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalPaise: bigint('line_total_paise', { mode: 'number' }).notNull(),
    hsnCode: text('hsn_code'),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);

/**
 * Every webhook is recorded before it is processed.
 *
 * The unique event id makes duplicate delivery a no-op, and the retained
 * payload lets a failed webhook be replayed rather than reconstructed from a
 * dashboard. See docs/PAYMENTS.md §5.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_idx').on(t.provider, t.eventId)],
);

/**
 * Human-readable order numbers come from order_number_seq, created in
 * migration 0001. Sequence, never randomness — see docs/COMPLIANCE.md §4.
 */
