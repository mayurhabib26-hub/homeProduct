/**
 * Pricing is the highest-value test surface in the codebase: every case here
 * is a way to charge a customer the wrong amount.
 *
 * Run: npm run test:pricing -w backend
 */
import assert from 'node:assert/strict';
import { rupees } from '@sv/shared';
import {
  computeTotals, discountFor, shippingFor, taxComponentOf, formatOrderNumber,
  FREE_SHIPPING_THRESHOLD_PAISE, SHIPPING_FEE_PAISE, COD_HANDLING_PAISE,
  type PricedLine, type CouponRule,
} from './pricing.js';

const line = (unit: number, qty: number): PricedLine => ({
  variantId: 1, productId: 1, productName: 'Rasam Powder', weight: '100g',
  sku: null, hsnCode: null,
  unitPricePaise: rupees(unit), quantity: qty, lineTotalPaise: rupees(unit) * qty,
});

const percent = (v: number, over = 0, cap: number | null = null): CouponRule => ({
  code: 'X', type: 'percent', value: v, minOrderPaise: over, maxDiscountPaise: cap,
});
const flat = (paise: number, over = 0): CouponRule => ({
  code: 'X', type: 'flat', value: paise, minOrderPaise: over, maxDiscountPaise: null,
});

/* --- subtotal ---------------------------------------------------------- */
assert.equal(computeTotals([line(110, 2)], null, 'upi').subtotalPaise, rupees(220));
assert.equal(computeTotals([line(110, 2), line(250, 1)], null, 'upi').subtotalPaise, rupees(470));

/* --- percent coupons --------------------------------------------------- */
assert.equal(discountFor(percent(10), rupees(500)), rupees(50));
assert.equal(discountFor(percent(10, 0, rupees(30)), rupees(500)), rupees(30), 'cap applies');
assert.equal(discountFor(percent(10, rupees(600)), rupees(500)), 0, 'min order not met');

/* --- flat coupons ------------------------------------------------------ */
assert.equal(discountFor(flat(rupees(50)), rupees(500)), rupees(50));
assert.equal(
  discountFor(flat(rupees(900)), rupees(500)),
  rupees(500),
  'a flat coupon larger than the order is clamped — never a negative total',
);
assert.equal(discountFor(null, rupees(500)), 0);

/* --- shipping threshold, both sides and exactly on it ------------------ */
assert.equal(shippingFor(FREE_SHIPPING_THRESHOLD_PAISE, 'upi'), 0, 'exactly at threshold is free');
assert.equal(shippingFor(FREE_SHIPPING_THRESHOLD_PAISE - 1, 'upi'), SHIPPING_FEE_PAISE, 'one paise under is charged');
assert.equal(shippingFor(FREE_SHIPPING_THRESHOLD_PAISE + 1, 'upi'), 0);
assert.equal(shippingFor(0, 'upi'), 0, 'an empty order is not charged shipping');

/* --- COD carries a handling fee ---------------------------------------- */
assert.equal(shippingFor(rupees(1000), 'cod'), COD_HANDLING_PAISE);
assert.equal(shippingFor(rupees(100), 'cod'), SHIPPING_FEE_PAISE + COD_HANDLING_PAISE);

/* --- a discount can push an order back under the free-shipping bar ----- */
{
  const t = computeTotals([line(250, 2)], percent(10), 'upi'); // ₹500 -> ₹450
  assert.equal(t.subtotalPaise, rupees(500));
  assert.equal(t.discountPaise, rupees(50));
  assert.equal(t.shippingPaise, SHIPPING_FEE_PAISE, 'shipping is judged after discount');
  assert.equal(t.totalPaise, rupees(450) + SHIPPING_FEE_PAISE);
}

/* --- totals never go negative ------------------------------------------ */
{
  const t = computeTotals([line(110, 1)], flat(rupees(5000)), 'upi');
  assert.equal(t.discountPaise, rupees(110));
  assert.equal(t.totalPaise, 0);
  assert.ok(t.totalPaise >= 0);
}

/* --- GST is inclusive, not added on top -------------------------------- */
assert.equal(taxComponentOf(rupees(105), 5), rupees(5), '₹105 inclusive of 5% contains ₹5 tax');
assert.equal(taxComponentOf(0, 5), 0);
{
  const t = computeTotals([line(110, 1)], null, 'upi');
  assert.ok(t.taxPaise < t.subtotalPaise, 'tax is a component, never an addition');
  assert.equal(t.totalPaise, rupees(110) + SHIPPING_FEE_PAISE, 'tax does not inflate the total');
}

/* --- everything stays an integer --------------------------------------- */
for (const v of Object.values(computeTotals([line(110, 3)], percent(10), 'cod'))) {
  assert.ok(Number.isInteger(v), `non-integer paise: ${v}`);
}

/* --- order numbers are sequential and formatted ------------------------- */
assert.equal(formatOrderNumber(4312, new Date('2026-09-15T00:00:00Z')), 'SV-2609-04312');
assert.equal(formatOrderNumber(1, new Date('2027-01-02T00:00:00Z')), 'SV-2701-00001');

console.log('pricing.ts: all assertions passed');
