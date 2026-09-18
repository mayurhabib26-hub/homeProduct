/**
 * Catalogue routes. Thin by design: validate, call a service, shape the
 * response. Rules live in services/. See docs/ARCHITECTURE.md §3.2.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute } from '../middleware/error-handler.js';
import { badRequest } from '../lib/errors.js';
import { env } from '../lib/env.js';
import * as catalogue from '../services/catalogue.js';
import { checkServiceability } from '../lib/shiprocket.js';
import { catalogueLimiter } from '../middleware/rate-limit.js';

export const catalogueRouter = Router();

catalogueRouter.use(catalogueLimiter);

/**
 * Browsing tolerates staleness — the CDN already serves this with
 * stale-while-revalidate. Checkout re-prices from the primary regardless.
 */
const cacheable = `public, s-maxage=${env.CATALOGUE_MAX_AGE}, stale-while-revalidate=300`;

const listQuery = z
  .object({
    category: z.string().max(40).optional(),
    search: z.string().max(80).optional(),
    sort: z.enum(['bestselling', 'price-asc', 'price-desc', 'rating']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(60).default(24),
  })
  .strict();

catalogueRouter.get(
  '/products',
  asyncRoute(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) throw badRequest('Invalid query', parsed.error.flatten().fieldErrors);

    const result = await catalogue.listProducts(parsed.data);
    res.setHeader('Cache-Control', cacheable);
    res.json(result);
  }),
);

const slugParam = z.string().regex(/^[a-z0-9-]{1,80}$/, 'Invalid product identifier');

catalogueRouter.get(
  '/products/:slug',
  asyncRoute(async (req, res) => {
    const slug = slugParam.safeParse(req.params.slug);
    if (!slug.success) throw badRequest('Invalid product identifier');

    const product = await catalogue.getProduct(slug.data);
    res.setHeader('Cache-Control', cacheable);
    res.json({ data: product });
  }),
);

catalogueRouter.get(
  '/recipes',
  asyncRoute(async (_req, res) => {
    const data = await catalogue.listRecipes();
    res.setHeader('Cache-Control', cacheable);
    res.json({ data });
  }),
);

const hydrateBody = z
  .object({
    items: z
      .array(
        z.object({
          productSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
          weight: z.string().max(20),
          quantity: z.number().int().positive().max(99),
        }),
      )
      .max(50),
  })
  .strict();

catalogueRouter.post(
  '/cart/hydrate',
  asyncRoute(async (req, res) => {
    const parsed = hydrateBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid cart', parsed.error.flatten().fieldErrors);

    // Never cached: this endpoint exists precisely to refresh stale prices.
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: await catalogue.hydrateCart(parsed.data.items) });
  }),
);

const pincodeParam = z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode');

catalogueRouter.get(
  '/shipping/serviceability/:pincode',
  asyncRoute(async (req, res) => {
    const parsed = pincodeParam.safeParse(req.params.pincode);
    if (!parsed.success) throw badRequest('Enter a 6-digit pincode.');

    const cod = req.query.cod === '1';
    const result = await checkServiceability(parsed.data, 0.5, cod);

    // Short cache: serviceability changes rarely, but not never.
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.json({ data: result });
  }),
);
