/**
 * Order pricing. The single place a total is computed.
 *
 * Nothing here accepts a price from a caller. Every amount is read from the
 * database or derived from a rule in this file, because the browser is a
 * display device and cannot be trusted with what something costs.
 * See docs/ARCHITECTURE.md §4.2.
 */
import { percentOf, rupees } from '@sv/shared';

/** Shipping rules. Server-side, so the client cannot talk its way out of them. */
export const FREE_SHIPPING_THRESHOLD_PAISE = rupees(499);
export const SHIPPING_FEE_PAISE = rupees(60);
/** Charged on COD to nudge prepaid; RTO costs ~9 points of margin. */
export const COD_HANDLING_PAISE = rupees(30);

/**
 * Above this, prepaid only.
 *
 * COD return-to-origin runs 15-30%, and each RTO costs two-way shipping on a
 * sale that never happened. The bigger the basket, the worse that is. OTP
 * verification is the stronger filter but needs a message provider — see
 * docs/AUTH.md §8. This cap works today.
 */
export const COD_MAX_ORDER_PAISE = rupees(2000);

export interface PricedLine {
  variantId: number;
  productId: number;
  productName: string;
  weight: string;
  sku: string | null;
  hsnCode: string | null;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface CouponRule {
  code: string;
  type: string;
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
}

export interface Totals {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
}

export const subtotalOf = (lines: PricedLine[]): number =>
  lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);

/**
 * Discount for a coupon that has already been validated as applicable.
 *
 * Clamped to the subtotal so a flat coupon larger than the order can never
 * produce a negative total — which would otherwise mean paying the customer.
 */
export function discountFor(coupon: CouponRule | null, subtotalPaise: number): number {
  if (!coupon) return 0;
  if (subtotalPaise < coupon.minOrderPaise) return 0;

  const raw =
    coupon.type === 'percent' ? percentOf(subtotalPaise, coupon.value) : coupon.value;

  const capped =
    coupon.maxDiscountPaise !== null ? Math.min(raw, coupon.maxDiscountPaise) : raw;

  return Math.max(0, Math.min(capped, subtotalPaise));
}

/** Free above the threshold, measured on the subtotal *after* discount. */
export function shippingFor(subtotalAfterDiscount: number, method: string): number {
  if (subtotalAfterDiscount <= 0) return 0;
  const base =
    subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_PAISE ? 0 : SHIPPING_FEE_PAISE;
  return base + (method === 'cod' ? COD_HANDLING_PAISE : 0);
}

/**
 * GST is inclusive of the displayed price in Indian retail: the listed ₹110
 * already contains the tax. This reports the tax component for the invoice
 * rather than adding anything on top.
 *
 * The rate is per-product HSN in reality; a single rate here is a placeholder
 * until HSN codes are assigned. See docs/COMPLIANCE.md §4.
 */
export const GST_RATE_PERCENT = 5;

export function taxComponentOf(taxableInclusivePaise: number, ratePercent = GST_RATE_PERCENT): number {
  return Math.round((taxableInclusivePaise * ratePercent) / (100 + ratePercent));
}

export function computeTotals(
  lines: PricedLine[],
  coupon: CouponRule | null,
  method: string,
): Totals {
  const subtotalPaise = subtotalOf(lines);
  const discountPaise = discountFor(coupon, subtotalPaise);
  const afterDiscount = subtotalPaise - discountPaise;
  const shippingPaise = shippingFor(afterDiscount, method);
  const totalPaise = afterDiscount + shippingPaise;
  const taxPaise = taxComponentOf(afterDiscount);

  return { subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise };
}

/** SV-2609-04312 */
export function formatOrderNumber(seq: number, now = new Date()): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `SV-${yy}${mm}-${String(seq).padStart(5, '0')}`;
}
