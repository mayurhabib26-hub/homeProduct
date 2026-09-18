/**
 * Money is stored and computed as integer paise, everywhere.
 *
 * Rupee floats are the bug that keeps giving: 0.1 + 0.2 !== 0.3, and a 10%
 * coupon on a rupee float rounds differently depending on where you round.
 * Razorpay's API works in paise too, so paise is also the wire format.
 *
 * Format only at the render layer. See docs/DATABASE.md §1.
 */

/** ₹110.50 -> 11050. For writing literals in seed data and tests. */
export const rupees = (r: number): number => Math.round(r * 100);

/** 11050 -> "₹110.50", 11000 -> "₹110". Trailing ".00" is dropped. */
export function formatPaise(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;

  // Indian digit grouping: 1,00,000 not 100,000.
  const grouped = whole.toLocaleString('en-IN');
  const body = fraction === 0 ? grouped : `${grouped}.${String(fraction).padStart(2, '0')}`;

  return `${negative ? '-' : ''}₹${body}`;
}

/**
 * Percentage of an amount, rounded to the nearest paise.
 *
 * Rounds half away from zero so a discount never silently gains a paise from
 * banker's rounding, which is what Math.round does on .5 for negatives.
 */
export const percentOf = (paise: number, percent: number): number =>
  Math.sign(paise) * Math.round(Math.abs(paise) * percent / 100);
