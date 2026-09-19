/**
 * Edge meta injection — the second half of docs/ARCHITECTURE.md §9.
 *
 * The build-time prerender writes real HTML for every product that existed
 * when the build ran. A product published afterwards has no page of its own,
 * so it falls back to the SPA shell and previews on WhatsApp with the
 * homepage's title and image — the exact failure the prerender exists to fix,
 * reappearing in the window between deploys.
 *
 * This Worker closes that window. It only does work when the static asset is
 * missing, so a prerendered page is served untouched at full CDN speed and
 * this costs nothing on the hot path.
 *
 * Deploy:
 *   npx wrangler deploy            (see edge/wrangler.toml)
 *
 * It is not a prerenderer. It injects <head> only, which is all a crawler
 * that does not run JavaScript reads.
 */

export interface Env {
  /** Static site (Pages / R2 / origin) that holds the prerendered build. */
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  /** Public catalogue API, e.g. https://api.svhomeproducts.in/api */
  API_BASE: string;
  /** Absolute site origin, for canonical and og:url. */
  SITE_URL: string;
}

const BRAND = 'S V Home Products';
const TIMEOUT_MS = 2_000;

interface Variant { weight: string; pricePaise: number; inStock: boolean; sku?: string | null }
interface Product {
  slug: string; name: string; regionalName?: string; shortDescription: string;
  categoryLabel: string; image: string; rating: number; reviewsCount: number;
  variants: Variant[];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rupees = (paise: number) => (paise / 100).toFixed(2);

/**
 * Strips the tags we are about to write.
 *
 * The shell already carries the homepage's title and OG tags. Appending ours
 * would leave both in the document, and a crawler takes the first it finds —
 * which is the bug, not the fix. Same reasoning as the prerender script.
 */
class DropExisting {
  element(el: { remove: () => void }) {
    el.remove();
  }
}

class InjectHead {
  constructor(private readonly html: string) {}
  element(el: { append: (c: string, o: { html: boolean }) => void }) {
    el.append(this.html, { html: true });
  }
}

function headFor(p: Product, site: string): string {
  const url = `${site}/product/${p.slug}`;
  const img = p.image?.startsWith('http') ? p.image : `${site}${p.image}`;
  const title = `${p.name}${p.regionalName ? ` (${p.regionalName})` : ''} | ${BRAND}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    alternateName: p.regionalName,
    description: p.shortDescription,
    image: img,
    category: p.categoryLabel,
    brand: { '@type': 'Brand', name: BRAND },
    offers: p.variants.map((v) => ({
      '@type': 'Offer',
      name: `${p.name} — ${v.weight}`,
      sku: v.sku ?? undefined,
      price: rupees(v.pricePaise),
      priceCurrency: 'INR',
      availability: v.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
    })),
    // Same rule as the prerender: never invent an aggregateRating. It is a
    // structured-data penalty and, for a food seller, a consumer-law problem.
    ...(p.reviewsCount > 0 && p.rating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.toFixed(1), reviewCount: p.reviewsCount } }
      : {}),
  };

  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(p.shortDescription)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(BRAND)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(p.shortDescription)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(p.shortDescription)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd, (_k, v) => v ?? undefined)}</script>`,
  ].join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const asset = await env.ASSETS.fetch(request);

    // A prerendered page exists — serve it untouched. This is the common case
    // and the Worker must not slow it down.
    if (asset.status !== 404) return asset;

    const m = /^\/product\/([a-z0-9-]{1,80})$/.exec(url.pathname);
    if (!m) return asset;

    let product: Product | null = null;
    try {
      const res = await fetch(`${env.API_BASE}/products/${m[1]}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) product = ((await res.json()) as { data?: Product }).data ?? null;
    } catch {
      // The catalogue being slow must not turn a page into an error. Falling
      // through serves the shell, which renders correctly for a human and
      // only costs a crawler its preview.
    }
    if (!product) return asset;

    // Serve the shell with this product's head, at 200 rather than the 404
    // the asset lookup returned.
    const shell = await env.ASSETS.fetch(new Request(new URL('/', url).toString(), request));
    if (!shell.ok) return asset;

    const rewritten = new HTMLRewriter()
      .on('title', new DropExisting())
      .on('meta[name="description"]', new DropExisting())
      .on('meta[property^="og:"]', new DropExisting())
      .on('meta[name^="twitter:"]', new DropExisting())
      .on('link[rel="canonical"]', new DropExisting())
      .on('head', new InjectHead(headFor(product, env.SITE_URL)))
      .transform(shell);

    return new Response(rewritten.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Short, because this exists to cover the gap until the next build
        // replaces it with a real prerendered page.
        'cache-control': 'public, max-age=0, s-maxage=300',
        'x-meta-source': 'edge',
      },
    });
  },
};
