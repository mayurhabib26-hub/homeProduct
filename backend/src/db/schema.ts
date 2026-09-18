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
