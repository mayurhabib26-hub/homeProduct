/**
 * Thin Razorpay REST client.
 *
 * Deliberately not the official SDK: this needs four calls, and a direct
 * fetch keeps the dependency surface and the failure modes obvious.
 *
 * Every call has a hard timeout. Razorpay is the one third party allowed in
 * an HTTP handler — order creation genuinely needs a synchronous response —
 * so it must not be able to hang a request. See docs/SCALING.md §2.4.
 */
import { env, razorpayConfigured } from './env.js';
import { ApiError } from './errors.js';
import { logger } from './logger.js';

const BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 5_000;

function authHeader(): string {
  const token = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  if (!razorpayConfigured) {
    throw new ApiError(503, 'ONLINE_PAYMENT_UNAVAILABLE', 'Online payment is not configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const description = (body as { error?: { description?: string } })?.error?.description;
      logger.error({ status: res.status, path, description }, 'razorpay call failed');
      throw new ApiError(502, 'PAYMENT_PROVIDER_ERROR', 'The payment provider could not be reached.');
    }

    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      logger.error({ path }, 'razorpay call timed out');
      throw new ApiError(504, 'PAYMENT_PROVIDER_TIMEOUT', 'The payment provider did not respond. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

/** Amount is paise, which is Razorpay's unit too — no conversion anywhere. */
export const createRazorpayOrder = (amountPaise: number, receipt: string) =>
  call<RazorpayOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, payment_capture: 1 }),
  });

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  method?: string;
  created_at: number;
}

export const fetchPayment = (paymentId: string) =>
  call<RazorpayPayment>(`/payments/${paymentId}`);

/** Payments captured in a window, for the nightly reconciliation. */
export const listPayments = (fromUnix: number, toUnix: number, count = 100) =>
  call<{ items: RazorpayPayment[] }>(`/payments?from=${fromUnix}&to=${toUnix}&count=${count}`);

export const refundPayment = (paymentId: string, amountPaise?: number) =>
  call<{ id: string; amount: number; status: string }>(`/payments/${paymentId}/refund`, {
    method: 'POST',
    body: JSON.stringify(amountPaise ? { amount: amountPaise } : {}),
  });
