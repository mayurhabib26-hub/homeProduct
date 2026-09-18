/** Admin API client. Cookies carry the session; nothing is kept in JS. */
import type { OrderTotals } from '@sv/shared';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class AdminApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string } }).error;
    throw new AdminApiError(e?.code ?? 'NETWORK_ERROR', e?.message ?? 'Something went wrong.');
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
  stuckOrders: { orderNumber: string; createdAt: string }[];
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
};

export type { OrderTotals };
