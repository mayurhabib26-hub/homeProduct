/**
 * Typed fetch wrappers. One function per endpoint, no logic.
 *
 * Every response is unwrapped from its envelope here, and every failure
 * becomes an ApiRequestError carrying the server's customer-safe message and
 * the requestId — so a support ticket can be grepped. See docs/API.md §1.
 */
import type {
  ApiError, ApiRecipe, HydratedCartLine, Paginated, ProductDetail, ProductSummary,
} from '@sv/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiRequestError extends Error {
  constructor(readonly code: string, message: string, readonly requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    let body: ApiError | undefined;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      // Non-JSON error body (a proxy or gateway page) — fall through.
    }
    throw new ApiRequestError(
      body?.error.code ?? 'NETWORK_ERROR',
      body?.error.message ?? 'We could not reach the shop. Please try again.',
      body?.requestId,
    );
  }

  return (await res.json()) as T;
}

export interface ProductListParams {
  category?: string;
  search?: string;
  sort?: 'bestselling' | 'price-asc' | 'price-desc' | 'rating';
  page?: number;
  limit?: number;
}

export const api = {
  products: {
    list: (params: ProductListParams = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '' && v !== 'all') q.set(k, String(v));
      }
      const qs = q.toString();
      return request<Paginated<ProductSummary>>(`/products${qs ? `?${qs}` : ''}`);
    },
    get: (slug: string) =>
      request<{ data: ProductDetail }>(`/products/${slug}`).then((r) => r.data),
  },
  recipes: {
    list: () => request<{ data: ApiRecipe[] }>('/recipes').then((r) => r.data),
  },
  cart: {
    hydrate: (items: { productSlug: string; weight: string; quantity: number }[]) =>
      request<{ data: { items: HydratedCartLine[]; unavailable: unknown[] } }>('/cart/hydrate', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }).then((r) => r.data),
  },
};
