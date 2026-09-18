/**
 * Catalogue reads.
 *
 * All the rules live here; routes stay thin. Nothing in this file trusts a
 * caller for price or availability — those come from the database every time.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { products, variants, recipes, reviews } from '../db/schema.js';
import { notFound } from '../lib/errors.js';

/**
 * Exact stock counts are never exposed: they invite scraping, they are stale
 * the moment they are sent, and the customer only needs to know whether they
 * can buy. See docs/API.md §2.
 */
const LOW_STOCK_THRESHOLD = 5;

const toVariant = (v: typeof variants.$inferSelect) => ({
  id: v.id,
  weight: v.weight,
  pricePaise: v.pricePaise,
  mrpPaise: v.mrpPaise ?? undefined,
  inStock: v.stockQty > 0,
  lowStock: v.stockQty > 0 && v.stockQty <= LOW_STOCK_THRESHOLD,
});

const toSummary = (p: typeof products.$inferSelect, vs: (typeof variants.$inferSelect)[]) => ({
  slug: p.slug,
  name: p.name,
  regionalName: p.regionalName ?? undefined,
  shortDescription: p.shortDescription,
  category: p.category,
  categoryLabel: p.categoryLabel,
  badge: p.badge ?? undefined,
  image: p.image,
  rating: Number(p.rating),
  reviewsCount: p.reviewsCount,
  featured: p.featured,
  isSignature: p.isSignature,
  variants: vs.map(toVariant),
});

async function loadPublished() {
  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .leftJoin(variants, and(eq(variants.productId, products.id), eq(variants.active, true)))
    .where(eq(products.published, true))
    .orderBy(desc(products.reviewsCount), asc(variants.pricePaise));

  // One query, grouped in memory — not N+1. Eleven products; this stays
  // cheap, and Redis fronts it from Phase 6.
  const byId = new Map<number, { p: typeof products.$inferSelect; vs: (typeof variants.$inferSelect)[] }>();
  for (const row of rows) {
    const entry = byId.get(row.products.id) ?? { p: row.products, vs: [] };
    if (row.variants) entry.vs.push(row.variants);
    byId.set(row.products.id, entry);
  }
  return [...byId.values()];
}

export type ListOptions = {
  category?: string;
  search?: string;
  sort?: 'bestselling' | 'price-asc' | 'price-desc' | 'rating';
  page: number;
  limit: number;
};

export async function listProducts(opts: ListOptions) {
  let items = await loadPublished();

  if (opts.category && opts.category !== 'all') {
    items = items.filter((i) => i.p.category === opts.category);
  }

  if (opts.search) {
    const q = opts.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.p.name.toLowerCase().includes(q) ||
        i.p.shortDescription.toLowerCase().includes(q) ||
        i.p.ingredients.some((ing) => ing.toLowerCase().includes(q)),
    );
  }

  const cheapest = (i: (typeof items)[number]) => i.vs[0]?.pricePaise ?? 0;
  const sorters: Record<NonNullable<ListOptions['sort']>, (a: typeof items[number], b: typeof items[number]) => number> = {
    bestselling: (a, b) => b.p.reviewsCount - a.p.reviewsCount,
    'price-asc': (a, b) => cheapest(a) - cheapest(b),
    'price-desc': (a, b) => cheapest(b) - cheapest(a),
    rating: (a, b) => Number(b.p.rating) - Number(a.p.rating),
  };
  items.sort(sorters[opts.sort ?? 'bestselling']);

  const total = items.length;
  const start = (opts.page - 1) * opts.limit;
  return {
    data: items.slice(start, start + opts.limit).map((i) => toSummary(i.p, i.vs)),
    meta: { total, page: opts.page, limit: opts.limit },
  };
}

export async function getProduct(slug: string) {
  const db = getDb();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.published, true)))
    .limit(1);

  if (!product) throw notFound('That product is no longer available.');

  const vs = await db
    .select()
    .from(variants)
    .where(and(eq(variants.productId, product.id), eq(variants.active, true)))
    .orderBy(asc(variants.pricePaise));

  const approved = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.productId, product.id), eq(reviews.approved, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(10);

  const related = (await loadPublished())
    .filter((i) => i.p.slug !== slug)
    .sort((a, b) => Number(b.p.category === product.category) - Number(a.p.category === product.category))
    .slice(0, 4)
    .map((i) => toSummary(i.p, i.vs));

  return {
    ...toSummary(product, vs),
    about: product.about,
    ingredients: product.ingredients,
    howToUse: product.howToUse,
    storage: product.storage,
    nutrition: product.nutrition,
    spiceLevel: product.spiceLevel,
    gallery: product.gallery,
    reviews: approved.map((r) => ({
      id: r.id,
      name: r.name,
      location: r.location ?? undefined,
      rating: r.rating,
      comment: r.comment,
      verified: r.verified,
      date: r.createdAt,
    })),
    related,
  };
}

/**
 * Resolve a cart's variant ids to current names, prices and availability.
 *
 * This is why the browser can store nothing but ids — and why this endpoint
 * must never be cached. See docs/PWA.md §2.
 */
export async function hydrateCart(lines: { productSlug: string; weight: string; quantity: number }[]) {
  const db = getDb();
  const items: unknown[] = [];
  const unavailable: { productSlug: string; weight: string; reason: string }[] = [];

  for (const line of lines) {
    const [row] = await db
      .select()
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .where(
        and(
          eq(products.slug, line.productSlug),
          eq(variants.weight, line.weight),
          eq(products.published, true),
          eq(variants.active, true),
        ),
      )
      .limit(1);

    if (!row) {
      unavailable.push({ ...line, reason: 'DISCONTINUED' });
      continue;
    }
    if (row.variants.stockQty <= 0) {
      unavailable.push({ ...line, reason: 'OUT_OF_STOCK' });
      continue;
    }
    items.push({
      productSlug: row.products.slug,
      name: row.products.name,
      image: row.products.image,
      weight: row.variants.weight,
      pricePaise: row.variants.pricePaise,
      quantity: line.quantity,
      linePaise: row.variants.pricePaise * line.quantity,
    });
  }

  return { items, unavailable };
}

export async function listRecipes() {
  const db = getDb();
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.published, true))
    .orderBy(asc(recipes.id));
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    difficulty: r.difficulty,
    image: r.image,
    description: r.description,
    pairedProductSlug: r.pairedProductSlug ?? undefined,
    ingredients: r.ingredients,
    instructions: r.instructions,
    chefTip: r.chefTip,
  }));
}

export async function countPublished() {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.published, true));
  return row?.n ?? 0;
}
