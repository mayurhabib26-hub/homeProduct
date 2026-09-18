/**
 * Test helpers.
 *
 * Resolve ids rather than hardcoding them. The seed used to TRUNCATE ...
 * RESTART IDENTITY so variant 1 was always Rasam 100g; it now uses DELETE to
 * preserve order history, and identity keeps climbing. Tests that assumed
 * id 1 broke — correctly.
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { products, variants } from './schema.js';

export async function variantIdFor(slug: string, weight: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ id: variants.id })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(products.slug, slug), eq(variants.weight, weight)))
    .limit(1);
  if (!row) throw new Error(`no variant for ${slug} ${weight} — is the database seeded?`);
  return row.id;
}

/** The variant the stock and concurrency tests operate on. */
export const testVariantId = () => variantIdFor('rasam-powder', '100g');
