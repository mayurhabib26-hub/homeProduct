/**
 * Populates the database from the original hardcoded catalogue.
 *
 * Idempotent: safe to re-run. It is how staging and CI get realistic data,
 * so it outlives the one-time migration. Seeding is not a migration —
 * see docs/DATABASE.md §5.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from './client.ts';
import { products, variants, recipes, reviews } from './schema.ts';
import { PRODUCTS } from './seed-data/products.ts';
import { RECIPES } from './seed-data/recipes.ts';
import { CLIENT_REVIEWS } from './seed-data/siteData.ts';

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
      rating: String(p.rating),
      reviewsCount: p.reviewsCount,
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
  (select count(*) from ${reviews})::int  reviews`)) as unknown as { rows: unknown[] };

console.log('seeded', counted.rows[0], `(${variantCount} variants inserted)`);
process.exit(0);
