/**
 * Build-time meta injection.
 *
 * The SPA ships one `index.html` for every URL, so a product link shared on
 * WhatsApp previews with the homepage title and no image. Google executes
 * JavaScript; WhatsApp, Facebook and Instagram do not — they read the bytes
 * they are served and leave. For an Indian D2C brand where a forwarded link is
 * a primary channel, that is the whole problem.
 *
 * This writes one real HTML file per route with the correct <head>: title,
 * description, canonical, Open Graph, Twitter card and JSON-LD. The same JS
 * bundle hydrates over it, so nothing about the app changes.
 *
 * It injects <head> only, not rendered body markup. Crawlers that do not run
 * JavaScript need the head; Google runs JavaScript and gets the body. Body
 * prerendering via renderToString is a later step and a bigger one — it needs
 * every component to be SSR-safe. See docs/ARCHITECTURE.md §9.
 *
 *   npm run prerender -w frontend        (after vite build)
 *
 * Degrades open: if the catalogue API is unreachable the static routes are
 * still written and the build succeeds. A missing product page is a worse
 * outcome than a failed deploy only if the deploy is what got you the page.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLICIES } from '../src/content/policies.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, '..', 'dist');
const API = process.env.PRERENDER_API_URL ?? 'http://127.0.0.1:4000/api';
const SITE = (process.env.SITE_URL ?? '').replace(/\/$/, '');
/**
 * Set this in CI and on any production build.
 *
 * Without it, an unreachable catalogue API degrades to "static routes only"
 * and the deploy succeeds with every product page carrying the homepage's
 * meta — the exact bug this script exists to fix, shipped quietly. A build
 * that cannot see the catalogue should fail loudly rather than produce a site
 * that looks fine until someone shares a link.
 */
const STRICT = process.env.PRERENDER_STRICT === '1';
const BRAND = 'S V Home Products';
/**
 * The share image for pages that have none of their own.
 *
 * This is a product photograph standing in for a proper 1200x630 branded card.
 * It works — WhatsApp will render it — but a real OG image with the mark and a
 * readable line of type is worth making. Replace this path when it exists.
 */
const DEFAULT_OG = '/images/combo_kitchen_trio_1788375324949.jpg';

if (STRICT && !SITE) {
  console.error('\nPRERENDER_STRICT is set but SITE_URL is not. Social previews need an absolute origin.\n');
  process.exit(1);
}

if (!SITE) {
  console.warn(
    '\n  SITE_URL is not set.\n' +
    '  Canonical URLs, og:url and the sitemap need an absolute origin, and\n' +
    '  WhatsApp will not render a preview from a relative og:image.\n' +
    '  Pages are still written; social previews stay broken until it is set.\n',
  );
}

const abs = (p: string) => (SITE ? `${SITE}${p.startsWith('/') ? p : `/${p}`}` : p);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rupees = (paise: number) => (paise / 100).toFixed(2);

interface Variant { weight: string; pricePaise: number; inStock: boolean; sku?: string | null }
interface Product {
  slug: string; name: string; regionalName?: string; shortDescription: string;
  categoryLabel: string; image: string; rating: number; reviewsCount: number;
  variants: Variant[];
}
interface Recipe {
  slug: string; title: string; subtitle: string; description: string; image: string;
  prepTime: string; cookTime: string; servings: string; difficulty: string;
  ingredients: string[]; instructions: string[];
}

interface Page {
  route: string;
  title: string;
  description: string;
  image?: string;
  /** Product pages are og:type "product"; everything else is a website. */
  ogType?: string;
  jsonLd?: unknown;
  /** Excluded from the sitemap — thin, private, or duplicative. */
  noIndex?: boolean;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`  could not reach ${API}${path} — ${String(err).slice(0, 80)}`);
    return null;
  }
}

/** Organization, emitted on the homepage. Feeds the knowledge panel. */
const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: BRAND,
  url: SITE || undefined,
  logo: SITE ? abs('/icon-512.png') : undefined,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Bengaluru',
    addressRegion: 'Karnataka',
    addressCountry: 'IN',
  },
};

function productJsonLd(p: Product) {
  const prices = p.variants.map((v) => v.pricePaise).filter((n) => n > 0);
  const anyInStock = p.variants.some((v) => v.inStock);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    alternateName: p.regionalName,
    description: p.shortDescription,
    image: p.image ? abs(p.image) : undefined,
    category: p.categoryLabel,
    brand: { '@type': 'Brand', name: BRAND },
    // One offer per variant: they are different SKUs at different prices, and
    // collapsing them to a range loses the weight a buyer is searching for.
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      name: `${p.name} — ${v.weight}`,
      sku: v.sku ?? undefined,
      price: rupees(v.pricePaise),
      priceCurrency: 'INR',
      availability: v.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: SITE ? abs(`/product/${p.slug}`) : undefined,
    })),
    // Only when reviews actually exist. Inventing an aggregateRating is a
    // structured-data penalty and, for a food seller, a consumer-law problem.
    ...(p.reviewsCount > 0 && p.rating > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: p.rating.toFixed(1),
            reviewCount: p.reviewsCount,
          },
        }
      : {}),
    ...(prices.length ? { additionalProperty: [] } : {}),
  };
}

/**
 * "15 mins" / "1 hr 20 min" -> ISO 8601 duration.
 *
 * schema.org wants PT15M; the database stores what a cook would write. An
 * unparseable value is omitted rather than guessed — Google drops a recipe
 * with a malformed duration, so a wrong value is worse than no value.
 */
function isoDuration(text: string): string | undefined {
  const h = /(\d+)\s*(?:h|hr|hour)/i.exec(text);
  const m = /(\d+)\s*(?:m|min|minute)/i.exec(text);
  // A bare number with no unit is minutes by convention in a recipe card.
  const bare = !h && !m ? /^\s*(\d+)\s*$/.exec(text) : null;
  const hours = h ? Number(h[1]) : 0;
  const mins = m ? Number(m[1]) : bare ? Number(bare[1]) : 0;
  if (!hours && !mins) return undefined;
  return `PT${hours ? `${hours}H` : ''}${mins ? `${mins}M` : ''}`;
}

function recipeJsonLd(r: Recipe) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: r.description || r.subtitle,
    image: r.image ? abs(r.image) : undefined,
    author: { '@type': 'Organization', name: BRAND },
    recipeCuisine: 'South Indian',
    recipeCategory: 'Main course',
    prepTime: isoDuration(r.prepTime),
    cookTime: isoDuration(r.cookTime),
    recipeYield: r.servings || undefined,
    recipeIngredient: r.ingredients?.length ? r.ingredients : undefined,
    // HowToStep rather than a plain string array: it is what earns the
    // step-by-step treatment in results and in Google Assistant.
    recipeInstructions: r.instructions?.length
      ? r.instructions.map((text, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text,
        }))
      : undefined,
  };
}

// --- assemble the page list -------------------------------------------------
const pages: Page[] = [
  {
    route: '/',
    title: `${BRAND} | Authentic South Indian Homemade Spice Powders`,
    description:
      'Handcrafted South Indian spice powders made at home in Bengaluru — rasam, sambar, puliyogare and chutney powders, delivered across India.',
    jsonLd: organization,
  },
  {
    route: '/shop',
    title: `Shop All Spice Powders | ${BRAND}`,
    description:
      'Every blend we make: rasam powder, sambar powder, puliyogare powder, gunpowder and chutney powders. Freshly ground, no preservatives.',
  },
  {
    route: '/about',
    title: `Our Story | ${BRAND}`,
    description:
      'A family kitchen in Bengaluru making South Indian spice powders the way they have always been made — small batches, whole spices, no shortcuts.',
  },
  {
    route: '/recipes',
    title: `Recipes | ${BRAND}`,
    description:
      'How to cook with our powders: rasam, sambar, puliyogare and more, written the way they are actually made at home.',
  },
  {
    route: '/contact',
    title: `Contact Us | ${BRAND}`,
    description: `Questions about an order, a blend or wholesale? Reach ${BRAND} in Bengaluru.`,
  },
  {
    route: '/track',
    title: `Track Your Order | ${BRAND}`,
    description: 'Enter your order number to see where your parcel is.',
    noIndex: true,
  },
];

for (const p of POLICIES) {
  pages.push({
    route: `/policies/${p.slug}`,
    title: `${p.title} | ${BRAND}`,
    description: p.summary ?? `${p.title} for ${BRAND}.`,
  });
}

console.log(`prerender: ${pages.length} static routes`);

/**
 * The catalogue paginates, so a single request silently truncates the site to
 * the first page. Page through to `meta.total` rather than passing a large
 * limit and hoping it stays large enough.
 */
async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const body = await fetchJson<{ data?: T[]; meta?: { total?: number } }>(
      `${path}${sep}page=${page}&limit=50`,
    );
    const batch = body?.data ?? [];
    out.push(...batch);
    const total = body?.meta?.total;
    if (!batch.length || total === undefined || out.length >= total) break;
  }
  return out;
}

const list = await fetchAll<Product>('/products');
for (const p of list) {
  pages.push({
    route: `/product/${p.slug}`,
    title: `${p.name}${p.regionalName ? ` (${p.regionalName})` : ''} | ${BRAND}`,
    description: p.shortDescription,
    image: p.image,
    ogType: 'product',
    jsonLd: productJsonLd(p),
  });
}
console.log(`prerender: ${list.length} product routes`);
if (STRICT && list.length === 0) {
  console.error(
    '\nPRERENDER_STRICT is set and the catalogue returned no products.\n' +
    `Is ${API} reachable from the build?\n`,
  );
  process.exit(1);
}

const recipes = await fetchAll<Recipe>('/recipes');
for (const r of recipes) {
  pages.push({
    route: `/recipes/${r.slug}`,
    title: `${r.title} Recipe | ${BRAND}`,
    description: r.description || r.subtitle || `${r.title} — a recipe from ${BRAND}.`,
    image: r.image,
    ogType: 'article',
    jsonLd: recipeJsonLd(r),
  });
}
console.log(`prerender: ${recipes.length} recipe routes`);

// --- write them -------------------------------------------------------------
const shell = await readFile(join(DIST, 'index.html'), 'utf8');

/**
 * Replace the head's meta block rather than appending to it.
 *
 * Appending a second <title> or og:title leaves the shell's homepage values in
 * the document and crawlers take the first one they find — which is the bug
 * this script exists to fix.
 *
 * This must strip everything it emits, including the canonical link and the
 * JSON-LD script. The homepage is written to dist/index.html, which is the
 * same file every other page is built from, so a second run without an
 * intervening `vite build` would otherwise stack a second canonical and a
 * second Product schema onto every page. The script has to be idempotent.
 */
const STRIP = new RegExp(
  '\\s*<(?:' +
    'title>[\\s\\S]*?</title' +
    '|meta\\s+(?:name="description"|name="robots"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*/?' +
    '|link\\s+rel="canonical"[^>]*/?' +
  ')>' +
  '|\\s*<script type="application/ld\\+json">[\\s\\S]*?</script>',
  'g',
);

function headFor(page: Page): string {
  const img = abs(page.image || DEFAULT_OG);
  const url = abs(page.route);
  const out = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    SITE ? `<link rel="canonical" href="${esc(url)}" />` : '',
    page.noIndex ? `<meta name="robots" content="noindex,follow" />` : '',
    `<meta property="og:site_name" content="${esc(BRAND)}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:type" content="${page.ogType ?? 'website'}" />`,
    SITE ? `<meta property="og:url" content="${esc(url)}" />` : '',
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    page.jsonLd
      ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd, (_k, v) => v ?? undefined)}</script>`
      : '',
  ].filter(Boolean);
  return out.map((l) => `    ${l}`).join('\n');
}

for (const page of pages) {
  const html = shell.replace(STRIP, '').replace('</head>', `${headFor(page)}\n  </head>`);
  const dir = page.route === '/' ? DIST : join(DIST, page.route);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf8');
}

// --- sitemap and robots -----------------------------------------------------
const indexable = pages.filter((p) => !p.noIndex);
if (SITE) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = indexable
    .map((p) => `  <url><loc>${esc(abs(p.route))}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  await writeFile(
    join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}

await writeFile(
  join(DIST, 'robots.txt'),
  [
    'User-agent: *',
    'Allow: /',
    // Never index a cart, a checkout or an order page. /order/ carries a
    // customer's name and address — hard rule 6 applies to crawlers too.
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /order/',
    'Disallow: /track',
    SITE ? `\nSitemap: ${abs('/sitemap.xml')}` : '',
    '',
  ].filter(Boolean).join('\n'),
);

/**
 * An og:image that 404s is a share with a blank grey box, which is the exact
 * failure this script exists to prevent — and it fails silently, because
 * nothing in a build checks that a meta tag points at a real file.
 */
const missing = new Set<string>();
for (const page of pages) {
  const rel = page.image || DEFAULT_OG;
  if (/^https?:/.test(rel)) continue;
  if (!existsSync(join(DIST, rel.replace(/^\//, '')))) missing.add(rel);
}
if (missing.size) {
  console.warn(`\n  ${missing.size} og:image path(s) are not in dist — those shares will preview blank:`);
  for (const m of missing) console.warn(`    ${m}`);
  console.warn('');
}

console.log(
  `prerender: wrote ${pages.length} pages, robots.txt${SITE ? `, sitemap.xml (${indexable.length} urls)` : ' (sitemap skipped — no SITE_URL)'}`,
);
