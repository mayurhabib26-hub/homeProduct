/**
 * Razorpay Checkout.js loader and opener.
 *
 * The script is loaded on demand — a customer browsing the catalogue should
 * not pay for a payment SDK they may never use. It is never cached by the
 * service worker: a stale payment SDK is a broken checkout, and it is not our
 * asset to version. See docs/PWA.md §2.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.head.appendChild(script);
  });

  return loading;
}

export async function openCheckout(options: Omit<RazorpayOptions, 'currency'>): Promise<void> {
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('The payment window is unavailable.');
  new window.Razorpay({ ...options, currency: 'INR' }).open();
}
