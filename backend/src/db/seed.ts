/**
 * Populates the database from the original hardcoded catalogue.
 *
 * Idempotent: safe to re-run. It is how staging and CI get realistic data,
 * so it outlives the one-time migration. Seeding is not a migration —
 * see docs/DATABASE.md §5.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from './client.js';
import { products, variants, recipes, reviews, coupons } from './schema.js';
import { rupees } from '@sv/shared';
import { PRODUCTS } from './seed-data/products.js';
import { RECIPES } from './seed-data/recipes.js';
import { CLIENT_REVIEWS } from './seed-data/siteData.js';

/**
 * Opening stock per variant.
 *
 * The original data only carried a boolean `inStock`, so a real number is a
 * business decision, not a conversion. This is a placeholder for development;
 * set real counts through the admin panel before launch.
 */
const OPENING_STOCK = 25;

const db = getDb();

// Truncate rather than upsert: seeding replaces the catalogue wholesale, and
// CASCADE keeps variants and reviews consistent with it.
await db.execute(sql`truncate table ${products}, ${recipes} restart identity cascade`);
await db.execute(sql`truncate table ${coupons}`);

/**
 * The codes that used to live in the frontend bundle, where anyone could read
 * them in the sources tab and edit the discount in devtools.
 */
await db.insert(coupons).values([
  { code: 'SVTRADITION', type: 'percent', value: 10, maxDiscountPaise: rupees(200), active: true },
  { code: 'WELCOME10', type: 'percent', value: 10, maxDiscountPaise: rupees(150), active: true },
  { code: 'TASTEOFHOME', type: 'flat', value: rupees(50), minOrderPaise: rupees(300), active: true },
]);

let variantCount = 0;

for (const p of PRODUCTS) {
  const [row] = await db
    .insert(products)
    .values({
      slug: p.id,
      name: p.name,
      regionalName: p.regionalName ?? null,
      shortDescription: p.shortDescription,
      category: p.category,
      categoryLabel: p.categoryLabel,
      badge: p.badge ?? null,
      about: p.about,
      ingredients: p.ingredients,
      howToUse: p.howToUse,
      storage: p.storage,
      nutrition: p.nutrition,
      spiceLevel: p.spiceLevel,
      image: p.image,
      gallery: p.gallery,
      // Derived from real review rows below, never from the original data.
      // The hardcoded storefront claimed 89-148 reviews per product while
      // four existed in total. Displaying a review count that is not backed
      // by reviews is a fabricated-review claim under the Consumer
      // Protection (E-Commerce) Rules. See docs/COMPLIANCE.md §5.
      rating: '0',
      reviewsCount: 0,
      featured: p.featured ?? false,
      isSignature: p.isSignature ?? false,
      published: true,
    })
    .returning({ id: products.id });

  for (const v of p.variants) {
    await db.insert(variants).values({
      productId: row.id,
      weight: v.weight,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise ?? null,
      stockQty: v.inStock ? OPENING_STOCK : 0,
      sku: `${p.id}-${v.weight}`.toUpperCase(),
      active: true,
    });
    variantCount++;
  }

  // Reviews record what was bought as "Product Name (250g)", so the weight
  // suffix is stripped before matching. Exact matching silently dropped
  // three of the four.
  const theirs = CLIENT_REVIEWS.filter(
    (r) => r.productPurchased.replace(/\s*\([^)]*\)\s*$/, '') === p.name,
  );
  for (const r of theirs) {
    await db.insert(reviews).values({
      productId: row.id,
      name: r.name,
      location: r.location,
      rating: Math.round(r.rating),
      comment: r.comment,
      productPurchased: r.productPurchased,
      verified: r.verified,
      approved: true,
    });
  }
}

// Derive rating and review count from the reviews actually inserted.
await db.execute(sql`
  update products p set
    reviews_count = (select count(*) from reviews r where r.product_id = p.id and r.approved),
    rating = coalesce((select round(avg(r.rating)::numeric, 1)
                         from reviews r where r.product_id = p.id and r.approved), 0)`);

for (const r of RECIPES) {
  await db.insert(recipes).values({
    slug: r.id,
    title: r.title,
    subtitle: r.subtitle,
    prepTime: r.prepTime,
    cookTime: r.cookTime,
    servings: r.servings,
    difficulty: r.difficulty,
    image: r.image,
    description: r.description,
    pairedProductSlug: r.pairedProductId ?? null,
    ingredients: r.ingredients,
    instructions: r.instructions,
    chefTip: r.chefTip,
    published: true,
  });
}

const counted = (await db.execute(sql`select
  (select count(*) from ${products})::int products,
  (select count(*) from ${variants})::int variants,
  (select count(*) from ${recipes})::int  recipes,
  (select count(*) from ${reviews})::int  reviews`)) as unknown as Array<Record<string, number>>;

console.log('seeded', counted[0] ?? counted, `(${variantCount} variants inserted)`);
process.exit(0);
