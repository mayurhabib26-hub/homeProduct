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
    /** GST rate for this HSN, in percent. Confirm per product with a CA. */
    gstRatePercent: integer('gst_rate_percent').notNull().default(5),

    /**
     * Legal Metrology declarations. Required on the listing page, legibly,
     * before purchase. See docs/COMPLIANCE.md §3.
     */
    manufacturerName: text('manufacturer_name'),
    manufacturerAddress: text('manufacturer_address'),
    countryOfOrigin: text('country_of_origin').notNull().default('India'),
    consumerCarePhone: text('consumer_care_phone'),
    consumerCareEmail: text('consumer_care_email'),
    shelfLifeMonths: integer('shelf_life_months'),

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

    /** Net quantity, declared: 100 + 'g'. */
    netQuantityValue: numeric('net_quantity_value', { precision: 10, scale: 2 }),
    netQuantityUnit: text('net_quantity_unit'),
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

/* ------------------------------------------------------------------ *
 * Admin — Phase 3
 * ------------------------------------------------------------------ */

export const adminUsers = pgTable(
  'admin_users',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    email: text('email').notNull(),
    /** bcrypt, cost 12. Never anything reversible. */
    passwordHash: text('password_hash').notNull(),
    /**
     * 'owner' can refund, reprice, manage coupons and export customer data.
     * 'staff' cannot. Not distrust — limiting the blast radius of a
     * compromised or mistaken account. See docs/ADMIN.md §3.
     */
    role: text('role').notNull().default('staff'),
    totpSecret: text('totp_secret'),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('admin_users_email_idx').on(t.email)],
);

/**
 * Refresh tokens are stored so a session can actually be revoked.
 * A purely stateless design cannot log anyone out.
 */
export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    adminUserId: bigint('admin_user_id', { mode: 'number' })
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    /** The token is hashed: a database dump must not hand over live sessions. */
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('admin_sessions_token_idx').on(t.tokenHash),
    index('admin_sessions_user_idx').on(t.adminUserId),
  ],
);

/**
 * Every admin mutation, with before and after.
 *
 * When a price is wrong or stock vanished, this is the only thing that
 * answers "who changed what, and when". Cheap to write, impossible to
 * reconstruct after the fact. See docs/DATABASE.md §2.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    adminUserId: bigint('admin_user_id', { mode: 'number' }).references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    adminEmail: text('admin_email'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Jobs — Phase 4
 * ------------------------------------------------------------------ */

/**
 * A durable job queue in Postgres.
 *
 * Deliberately not Redis + BullMQ yet. At this order volume a job table with
 * FOR UPDATE SKIP LOCKED gives the same guarantees — at-least-once delivery,
 * retries with backoff, visibility into failures — without a second piece of
 * infrastructure to run, monitor and pay for.
 *
 * Switch to BullMQ when Redis is already in the stack for catalogue caching
 * and distributed rate limits (Stage 2), or when queue throughput genuinely
 * needs it. The interface in lib/queue.ts is the seam. See docs/SCALING.md.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    queue: text('queue').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    /** When this job becomes eligible to run. Backoff moves it forward. */
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    /**
     * Set by the producer for jobs that must not be enqueued twice —
     * "confirmation for order X". UNIQUE, so a retry cannot double-send.
     */
    dedupeKey: text('dedupe_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('jobs_claim_idx').on(t.status, t.runAfter),
    uniqueIndex('jobs_dedupe_idx').on(t.dedupeKey),
  ],
);

/* ------------------------------------------------------------------ *
 * Compliance — Phase 5
 * ------------------------------------------------------------------ */

/**
 * Production batches.
 *
 * Manufacture date is per batch, not per product. Displaying one fixed date
 * for something made continuously is a false declaration under the Legal
 * Metrology (Packaged Commodities) Rules. See docs/COMPLIANCE.md §3.
 */
export const batches = pgTable(
  'batches',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    variantId: bigint('variant_id', { mode: 'number' })
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    batchCode: text('batch_code').notNull(),
    mfgMonth: integer('mfg_month').notNull(),
    mfgYear: integer('mfg_year').notNull(),
    /** Derived from the product's shelf life at creation. */
    bestBefore: timestamp('best_before', { withTimezone: true }).notNull(),
    quantityMade: integer('quantity_made').notNull().default(0),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('batches_variant_code_idx').on(t.variantId, t.batchCode),
    index('batches_variant_idx').on(t.variantId),
    check('batches_month_range', sql`${t.mfgMonth} between 1 and 12`),
  ],
);

/**
 * Tax invoices.
 *
 * Numbering is sequential per financial year with no gaps — a gap is a
 * question you get asked in a GST audit. Retained 8 years.
 * See docs/COMPLIANCE.md §4.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    orderId: bigint('order_id', { mode: 'number' })
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' }),
    /** SV/2026-27/00001 */
    invoiceNumber: text('invoice_number').notNull(),
    /** Indian FY label, e.g. '2026-27'. */
    financialYear: text('financial_year').notNull(),
    sequence: integer('sequence').notNull(),
    placeOfSupply: text('place_of_supply').notNull(),
    /** True when seller and buyer are in the same state. */
    intraState: boolean('intra_state').notNull(),
    taxableValuePaise: bigint('taxable_value_paise', { mode: 'number' }).notNull(),
    cgstPaise: bigint('cgst_paise', { mode: 'number' }).notNull().default(0),
    sgstPaise: bigint('sgst_paise', { mode: 'number' }).notNull().default(0),
    igstPaise: bigint('igst_paise', { mode: 'number' }).notNull().default(0),
    totalPaise: bigint('total_paise', { mode: 'number' }).notNull(),
    /** Per-line breakdown, frozen at issue. */
    lines: jsonb('lines').notNull(),
    pdfUrl: text('pdf_url'),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invoices_number_idx').on(t.invoiceNumber),
    uniqueIndex('invoices_order_idx').on(t.orderId),
    uniqueIndex('invoices_fy_sequence_idx').on(t.financialYear, t.sequence),
  ],
);

/**
 * Abandoned carts.
 *
 * Captured when someone reaches checkout and gives a phone number, so there
 * is something to recover and someone to recover it from. A cart with no
 * phone is not recorded — there would be nothing to do with it.
 *
 * An abandoned-cart nudge is a PROMOTIONAL message in India, not a
 * transactional one. It needs marketing consent under the DPDP Act, a
 * registered template on a registered header under TRAI's TCCCPA rules, and
 * it may only be sent between 09:00 and 21:00 IST. See docs/COMPLIANCE.md.
 */
export const abandonedCarts = pgTable(
  'abandoned_carts',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    /** The natural key: one open cart per person. */
    phone: text('phone').notNull(),
    /** Variant ids and quantities only. Price is resolved when the message is
     *  built, never stored here — the server owns price (hard rule 1). */
    items: jsonb('items').notNull(),
    /** For reporting only. Never quoted back to the customer. */
    valuePaise: bigint('value_paise', { mode: 'number' }).notNull().default(0),

    /** Set when an order from this phone is placed. Stops the reminder. */
    recoveredAt: timestamp('recovered_at', { withTimezone: true }),
    recoveredOrderNumber: text('recovered_order_number'),

    /** Set once a reminder actually goes out. One per cart, ever. */
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
    /** Why a reminder was not sent, when it was not. Makes the guards visible. */
    skippedReason: text('skipped_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('abandoned_carts_phone_idx').on(t.phone),
    index('abandoned_carts_sweep_idx').on(t.recoveredAt, t.remindedAt, t.updatedAt),
  ],
);

/**
 * Marketing consent, separate from the transaction and never pre-ticked.
 * Recorded with a timestamp because consent must be demonstrable.
 * See docs/COMPLIANCE.md §6.
 */
export const marketingConsent = pgTable(
  'marketing_consent',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    phone: text('phone').notNull(),
    email: text('email'),
    granted: boolean('granted').notNull(),
    source: text('source').notNull(),
    ip: text('ip'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('marketing_consent_phone_idx').on(t.phone)],
);
