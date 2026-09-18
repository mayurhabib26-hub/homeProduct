/**
 * Product and catalogue management.
 *
 * Pricing is owner-only; content is not. A staff member fixing a typo in a
 * description should not need the account that can move money.
 */
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { asyncRoute } from '../middleware/error-handler.js';
import { requireAdmin, requireRole } from '../middleware/admin-auth.js';
import { badRequest, notFound, ApiError } from '../lib/errors.js';
import { getDb } from '../db/client.js';
import { products, variants } from '../db/schema.js';
import { storeImage } from '../lib/storage.js';
import { record } from '../services/admin-auth.js';

export const adminProductsRouter = Router();

adminProductsRouter.use('/admin', requireAdmin);

/** Memory storage: files go straight to R2 or disk, never to a temp path. */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

adminProductsRouter.get(
  '/admin/products',
  asyncRoute(async (_req, res) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(products)
      .leftJoin(variants, eq(variants.productId, products.id))
      .orderBy(asc(products.name), asc(variants.pricePaise));

    const grouped = new Map<number, Record<string, unknown>>();
    for (const row of rows) {
      const entry = grouped.get(row.products.id) ?? { ...row.products, variants: [] };
      if (row.variants) (entry.variants as unknown[]).push(row.variants);
      grouped.set(row.products.id, entry);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: [...grouped.values()] });
  }),
);

adminProductsRouter.get(
  '/admin/products/:slug',
  asyncRoute(async (req, res) => {
    const db = getDb();
    const [product] = await db.select().from(products).where(eq(products.slug, req.params.slug)).limit(1);
    if (!product) throw notFound('No such product.');

    const vs = await db
      .select()
      .from(variants)
      .where(eq(variants.productId, product.id))
      .orderBy(asc(variants.pricePaise));

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: { ...product, variants: vs } });
  }),
);

const productBody = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{2,80}$/, 'Lowercase letters, numbers and hyphens only'),
    name: z.string().min(2).max(160),
    regionalName: z.string().max(160).nullable().optional(),
    shortDescription: z.string().min(5).max(400),
    category: z.enum(['classics', 'spices', 'chutney_podi', 'combos']),
    categoryLabel: z.string().min(2).max(80),
    badge: z.string().max(60).nullable().optional(),
    about: z.string().min(10),
    ingredients: z.array(z.string().max(120)).min(1),
    howToUse: z.array(z.string().max(300)).min(1),
    storage: z.string().min(5).max(400),
    nutrition: z.object({
      servingSize: z.string().max(40),
      energy: z.string().max(40),
      protein: z.string().max(40),
      carbohydrates: z.string().max(40),
      fat: z.string().max(40),
    }),
    spiceLevel: z.string().max(40),
    image: z.string().max(400),
    gallery: z.array(z.string().max(400)).default([]),
    featured: z.boolean().default(false),
    isSignature: z.boolean().default(false),
    published: z.boolean().default(false),
    /** Required before an invoice can be raised. See docs/COMPLIANCE.md §4. */
    hsnCode: z.string().max(20).nullable().optional(),
  })
  .strict();

adminProductsRouter.post(
  '/admin/products',
  asyncRoute(async (req, res) => {
    const parsed = productBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the product details.', parsed.error.flatten().fieldErrors);

    if (parsed.data.published && !parsed.data.hsnCode) {
      throw new ApiError(422, 'HSN_REQUIRED', 'An HSN code is required before a product can be published.');
    }

    const db = getDb();
    const [created] = await db.insert(products).values(parsed.data).returning();
    await record(req.admin!, 'product.create', 'product', created.slug, null, created, req.ip);
    res.status(201).json({ data: created });
  }),
);

adminProductsRouter.patch(
  '/admin/products/:slug',
  asyncRoute(async (req, res) => {
    const parsed = productBody.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the product details.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const [before] = await db.select().from(products).where(eq(products.slug, req.params.slug)).limit(1);
    if (!before) throw notFound('No such product.');

    const wantsPublished = parsed.data.published ?? before.published;
    const hsn = parsed.data.hsnCode ?? before.hsnCode;
    if (wantsPublished && !hsn) {
      throw new ApiError(422, 'HSN_REQUIRED', 'An HSN code is required before a product can be published.');
    }

    const [after] = await db
      .update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, before.id))
      .returning();

    await record(req.admin!, 'product.update', 'product', after.slug, before, after, req.ip);
    res.json({ data: after });
  }),
);

/**
 * Unpublish rather than delete.
 *
 * Order history references products, and a discontinued item must not take
 * past orders with it. See docs/DATABASE.md §2.
 */
adminProductsRouter.delete(
  '/admin/products/:slug',
  requireRole('owner'),
  asyncRoute(async (req, res) => {
    const db = getDb();
    const [after] = await db
      .update(products)
      .set({ published: false })
      .where(eq(products.slug, req.params.slug))
      .returning();
    if (!after) throw notFound('No such product.');

    await record(req.admin!, 'product.unpublish', 'product', after.slug, null, after, req.ip);
    res.json({ data: { slug: after.slug, published: false } });
  }),
);

const variantBody = z
  .object({
    weight: z.string().min(1).max(20),
    pricePaise: z.number().int().positive(),
    mrpPaise: z.number().int().positive().nullable().optional(),
    stockQty: z.number().int().min(0).default(0),
    sku: z.string().max(80).nullable().optional(),
    active: z.boolean().default(true),
  })
  .strict();

adminProductsRouter.post(
  '/admin/products/:slug/variants',
  requireRole('owner'),
  asyncRoute(async (req, res) => {
    const parsed = variantBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Check the pack details.', parsed.error.flatten().fieldErrors);

    const db = getDb();
    const [product] = await db.select().from(products).where(eq(products.slug, req.params.slug)).limit(1);
    if (!product) throw notFound('No such product.');

    const [created] = await db
      .insert(variants)
      .values({ ...parsed.data, productId: product.id })
      .returning();

    await record(req.admin!, 'variant.create', 'variant', String(created.id), null, created, req.ip);
    res.status(201).json({ data: created });
  }),
);

adminProductsRouter.post(
  '/admin/uploads',
  upload.single('image'),
  asyncRoute(async (req, res) => {
    if (!req.file) throw badRequest('No image was uploaded.');
    const stored = await storeImage(req.file.buffer, req.file.mimetype, req.file.originalname);
    await record(req.admin!, 'image.upload', 'image', stored.url, null, { bytes: stored.bytes }, req.ip);
    res.status(201).json({ data: stored });
  }),
);
