/**
 * Typed fetch wrappers. One function per endpoint, no logic.
 *
 * Every response is unwrapped from its envelope here, and every failure
 * becomes an ApiRequestError carrying the server's customer-safe message and
 * the requestId — so a support ticket can be grepped. See docs/API.md §1.
 */
import type {
  ApiError, ApiRecipe, CreateOrderRequest, CreatedOrder, HydratedCartLine,
  OrderLineRequest, Paginated, ProductDetail, ProductSummary, TrackedOrder,
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
    // The customer session is an HttpOnly cookie, and in production the API
    // lives on api.<domain> while the shop is on <domain>. 'include' is what
    // carries it across that subdomain boundary; it stays SameSite=Lax
    // because those are the same *site*. See docs/AUTH.md §2.
    credentials: 'include',
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

export interface CustomerIdentity { phone: string; name: string | null; email: string | null }

export interface SavedAddress {
  id: number;
  label: string | null;
  name: string;
  phone: string;
  address: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface CustomerOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: string;
  trackingNumber: string | null;
  courier: string | null;
  items: { productName: string; weight: string; quantity: number; unitPricePaise: number }[];
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ data: { retryAfterSeconds: number; simulated: boolean } }>('/auth/otp/request', {
      method: 'POST', body: JSON.stringify({ phone }),
    }).then((r) => r.data),
  verifyOtp: (phone: string, code: string) =>
    request<{ data: { phone: string; isNew: boolean; ordersLinked: number } }>('/auth/otp/verify', {
      method: 'POST', body: JSON.stringify({ phone, code }),
    }).then((r) => r.data),
  logout: () => request<{ data: { ok: boolean } }>('/auth/logout', { method: 'POST' }).then((r) => r.data),
  me: () => request<{ data: CustomerIdentity | null }>('/auth/me').then((r) => r.data),
  myOrders: () => request<{ data: CustomerOrder[] }>('/auth/orders').then((r) => r.data),

  addresses: {
    list: () => request<{ data: SavedAddress[] }>('/auth/addresses').then((r) => r.data),
    create: (body: Omit<SavedAddress, 'id'>) =>
      request<{ data: SavedAddress }>('/auth/addresses', {
        method: 'POST', body: JSON.stringify(body),
      }).then((r) => r.data),
    update: (id: number, body: Partial<Omit<SavedAddress, 'id'>>) =>
      request<{ data: SavedAddress }>(`/auth/addresses/${id}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }).then((r) => r.data),
    remove: (id: number) =>
      request<{ data: { id: number } }>(`/auth/addresses/${id}`, { method: 'DELETE' }).then((r) => r.data),
  },

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
  coupons: {
    validate: (code: string, items: OrderLineRequest[]) =>
      request<{ data: { code: string; discountPaise: number } }>('/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code, items }),
      }).then((r) => r.data),
  },
  orders: {
    /**
     * The Idempotency-Key is generated per checkout attempt, not per request,
     * so a retry after a timeout returns the original order instead of
     * creating a second one.
     */
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request<{ data: CreatedOrder }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      }).then((r) => r.data),

    verifyPayment: (payload: {
      razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string;
    }) =>
      request<{ data: { orderNumber: string } }>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((r) => r.data),

    track: (orderNumber: string, phone: string) =>
      request<{ data: TrackedOrder }>(
        `/orders/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`,
      ).then((r) => r.data),
  },
  cart: {
    hydrate: (items: { productSlug: string; weight: string; quantity: number }[]) =>
      request<{ data: { items: HydratedCartLine[]; unavailable: unknown[] } }>('/cart/hydrate', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }).then((r) => r.data),
  },
};
