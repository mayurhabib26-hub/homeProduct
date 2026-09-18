/**
 * Shiprocket — pickup booking, AWB assignment and serviceability.
 *
 * Unconfigured, serviceability falls back to an optimistic answer and booking
 * throws, so orders are still accepted and simply wait for a manual dispatch.
 * Refusing orders because a courier integration is not set up would be the
 * wrong failure.
 */
import { env } from './env.js';
import { ApiError } from './errors.js';
import { logger } from './logger.js';

const BASE = 'https://apiv2.shiprocket.in/v1/external';
const TIMEOUT_MS = 10_000;

export const shiprocketConfigured = Boolean(env.SHIPROCKET_EMAIL && env.SHIPROCKET_PASSWORD);

/** Tokens last ~10 days; cached in memory and refreshed on expiry. */
let cachedToken: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new ApiError(502, 'COURIER_AUTH_FAILED', 'Could not reach the courier.');

  const body = (await res.json()) as { token: string };
  cachedToken = { token: body.token, expiresAt: Date.now() + 9 * 86_400_000 };
  return body.token;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!shiprocketConfigured) {
    throw new ApiError(503, 'COURIER_NOT_CONFIGURED', 'Courier integration is not configured.');
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error({ path, status: res.status, detail: detail.slice(0, 200) }, 'shiprocket call failed');
    throw new ApiError(502, 'COURIER_ERROR', 'The courier service could not be reached.');
  }
  return (await res.json()) as T;
}

export interface Serviceability {
  serviceable: boolean;
  codAvailable: boolean;
  estimatedDays: number | null;
  /** True when we could not actually ask — do not present as fact. */
  assumed: boolean;
}

export async function checkServiceability(
  deliveryPincode: string,
  weightKg = 0.5,
  cod = false,
): Promise<Serviceability> {
  if (!shiprocketConfigured) {
    // Optimistic, and flagged as such. An unconfigured courier must not stop
    // the shop taking orders.
    return { serviceable: true, codAvailable: true, estimatedDays: null, assumed: true };
  }

  const params = new URLSearchParams({
    pickup_postcode: env.PICKUP_PINCODE,
    delivery_postcode: deliveryPincode,
    weight: String(weightKg),
    cod: cod ? '1' : '0',
  });

  const body = await call<{ data?: { available_courier_companies?: Array<{ etd?: string; cod?: number }> } }>(
    `/courier/serviceability/?${params}`,
  );

  const couriers = body.data?.available_courier_companies ?? [];
  const days = couriers
    .map((c) => Number(String(c.etd ?? '').match(/\d+/)?.[0]))
    .filter((n) => Number.isFinite(n));

  return {
    serviceable: couriers.length > 0,
    codAvailable: couriers.some((c) => c.cod === 1),
    estimatedDays: days.length ? Math.min(...days) : null,
    assumed: false,
  };
}

export interface ShipmentBooking {
  shipmentId: number;
  awb: string | null;
  courier: string | null;
}

export async function bookShipment(input: {
  orderNumber: string;
  placedAt: Date;
  customerName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string | null;
  paymentMethod: string;
  totalPaise: number;
  items: { name: string; sku: string | null; quantity: number; unitPricePaise: number }[];
}): Promise<ShipmentBooking> {
  const body = await call<{ shipment_id: number; awb_code?: string; courier_name?: string }>(
    '/orders/create/adhoc',
    {
      method: 'POST',
      body: JSON.stringify({
        order_id: input.orderNumber,
        order_date: input.placedAt.toISOString().slice(0, 10),
        pickup_location: 'Primary',
        billing_customer_name: input.customerName,
        billing_address: input.address,
        billing_city: input.city,
        billing_pincode: input.pincode,
        billing_state: input.state,
        billing_country: 'India',
        billing_email: input.email ?? '',
        billing_phone: input.phone,
        shipping_is_billing: true,
        order_items: input.items.map((i) => ({
          name: i.name,
          sku: i.sku ?? i.name,
          units: i.quantity,
          // Shiprocket wants rupees; paise stays the unit everywhere else.
          selling_price: i.unitPricePaise / 100,
        })),
        payment_method: input.paymentMethod === 'cod' ? 'COD' : 'Prepaid',
        sub_total: input.totalPaise / 100,
        length: 15, breadth: 12, height: 8, weight: 0.5,
      }),
    },
  );

  return {
    shipmentId: body.shipment_id,
    awb: body.awb_code ?? null,
    courier: body.courier_name ?? null,
  };
}
