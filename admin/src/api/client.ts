/** Admin API client. Cookies carry the session; nothing is kept in JS. */
import type { OrderTotals } from '@sv/shared';

/**
 * Absolute, because the admin runs on its own subdomain. There is no
 * relative /api here — that was only possible when admin and API shared an
 * origin. See docs/DEPLOYMENT.md §3.
 */
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class AdminApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /**
     * Per-field validation errors from the server, keyed by field name.
     *
     * Carried through rather than flattened into the message: a form can put
     * "Lowercase letters, numbers and hyphens only" next to the slug input,
     * which is worth far more than a toast listing six problems at once.
     */
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // 'include', not 'same-origin': the session cookie must travel to another
    // subdomain. It stays SameSite=Lax because admin.<domain> and
    // api.<domain> are the same *site* — only unrelated domains would force
    // SameSite=None. See docs/AUTH.md §2.
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: Record<string, string[]> } }).error;
    throw new AdminApiError(e?.code ?? 'NETWORK_ERROR', e?.message ?? 'Something went wrong.', e?.details);
  }
  return (body as { data: T }).data;
}

export interface AdminIdentity { email: string; role: 'owner' | 'staff' }

export interface AdminOrderRow {
  orderNumber: string; status: string; paymentStatus: string; paymentMethod: string;
  customerName: string; city: string; totalPaise: number; createdAt: string;
  allowedTransitions: string[];
}

export interface AdminOrderDetail extends AdminOrderRow {
  phone: string; email?: string | null; address: string; landmark?: string | null;
  state: string; pincode: string; notes?: string | null;
  subtotalPaise: number; discountPaise: number; shippingPaise: number; taxPaise: number;
  couponCode?: string | null; trackingNumber?: string | null; courier?: string | null;
  razorpayPaymentId?: string | null;
  items: { productName: string; weight: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }[];
  auditTrail: { adminEmail: string | null; action: string; before: unknown; after: unknown; createdAt: string }[];
}

export interface InventoryRow {
  variantId: number; slug: string; productName: string; weight: string;
  pricePaise: number; stockQty: number; sku: string | null; active: boolean;
}

export interface DashboardStats {
  orders_today: number; revenue_today: number; revenue_week: number;
  awaiting_packing: number; low_stock: number; failed_payments: number;
  pending_reviews: number;
  jobs_pending: number;
  jobs_failed: number;
  stuckOrders: { orderNumber: string; createdAt: string }[];
  failedJobs: { queue: string; payload: Record<string, unknown>; lastError: string | null }[];
}

export interface AdminProduct {
  slug: string; name: string; regionalName?: string | null; shortDescription: string;
  category: string; categoryLabel: string; badge?: string | null; about: string;
  ingredients: string[]; howToUse: string[]; storage: string;
  nutrition: Record<string, string>; spiceLevel: string;
  image: string; gallery: string[]; featured: boolean; isSignature: boolean;
  published: boolean; hsnCode?: string | null;
  variants: { id: number; weight: string; pricePaise: number; stockQty: number; active: boolean }[];
}

export interface AdminCoupon {
  code: string; type: 'percent' | 'flat'; value: number;
  minOrderPaise: number; maxDiscountPaise: number | null;
  usageLimit: number | null; usedCount: number; active: boolean;
  expiresAt: string | null;
}

export interface AdminReview {
  id: number; name: string; rating: number; comment: string;
  approved: boolean; createdAt: string; productName: string;
}

export const adminApi = {
  login: (email: string, password: string) =>
    call<AdminIdentity>('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => call<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  me: () => call<AdminIdentity>('/admin/me'),
  stats: () => call<DashboardStats>('/admin/stats'),
  orders: (params: { status?: string; phone?: string } = {}) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    return call<AdminOrderRow[]>(`/admin/orders${q.toString() ? `?${q}` : ''}`);
  },
  order: (orderNumber: string) => call<AdminOrderDetail>(`/admin/orders/${orderNumber}`),
  setStatus: (orderNumber: string, body: Record<string, unknown>) =>
    call<unknown>(`/admin/orders/${orderNumber}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  refund: (orderNumber: string, body: Record<string, unknown>) =>
    call<unknown>(`/admin/orders/${orderNumber}/refund`, { method: 'POST', body: JSON.stringify(body) }),
  inventory: () => call<InventoryRow[]>('/admin/inventory'),
  updateVariant: (id: number, body: Record<string, unknown>) =>
    call<InventoryRow>(`/admin/variants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  products: () => call<AdminProduct[]>('/admin/products'),
  product: (slug: string) => call<AdminProduct>(`/admin/products/${slug}`),
  updateProduct: (slug: string, body: Record<string, unknown>) =>
    call<AdminProduct>(`/admin/products/${slug}`, { method: 'PATCH', body: JSON.stringify(body) }),
  createProduct: (body: Record<string, unknown>) =>
    call<AdminProduct>('/admin/products', { method: 'POST', body: JSON.stringify(body) }),
  /**
   * DELETE unpublishes; it does not destroy the row. A product with order
   * history must survive being discontinued or its invoices stop reconciling
   * — the same reason order_items are snapshots.
   */
  unpublishProduct: (slug: string) =>
    call<unknown>(`/admin/products/${slug}`, { method: 'DELETE' }),
  addVariant: (slug: string, body: Record<string, unknown>) =>
    call<unknown>(`/admin/products/${slug}/variants`, { method: 'POST', body: JSON.stringify(body) }),

  uploadImage: async (file: File) => {
    // FormData sets its own multipart boundary — do not send a content-type.
    const body = new FormData();
    body.append('image', file);
    const res = await fetch(`${BASE}/admin/uploads`, { method: 'POST', // 'include', not 'same-origin': the session cookie must travel to another
    // subdomain. It stays SameSite=Lax because admin.<domain> and
    // api.<domain> are the same *site* — only unrelated domains would force
    // SameSite=None. See docs/AUTH.md §2.
    credentials: 'include', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (json as { error?: { code?: string; message?: string; details?: Record<string, string[]> } }).error;
      throw new AdminApiError(e?.code ?? 'UPLOAD_FAILED', e?.message ?? 'Upload failed.');
    }
    return (json as { data: { url: string; bytes: number } }).data;
  },

  coupons: () => call<AdminCoupon[]>('/admin/coupons'),
  createCoupon: (body: Record<string, unknown>) =>
    call<AdminCoupon>('/admin/coupons', { method: 'POST', body: JSON.stringify(body) }),
  setCouponActive: (code: string, active: boolean) =>
    call<AdminCoupon>(`/admin/coupons/${code}`, { method: 'PATCH', body: JSON.stringify({ active }) }),

  reviews: () => call<AdminReview[]>('/admin/reviews'),
  setReviewApproved: (id: number, approved: boolean) =>
    call<AdminReview>(`/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ approved }) }),
};

export type { OrderTotals };
