/**
 * GST rules. Run: npm run test:gst -w backend
 *
 * Every case here is a way to file a wrong return.
 */
import assert from 'node:assert/strict';
import { rupees } from '@sv/shared';
import {
  computeInvoice, splitInclusive, financialYearOf, formatInvoiceNumber, rupeesInWords,
  type InvoiceLineInput,
} from './gst.js';

const line = (inclusive: number, qty = 1, rate = 5): InvoiceLineInput => ({
  description: 'Rasam Powder 100g',
  hsnCode: '0910',
  quantity: qty,
  unitPricePaise: rupees(inclusive),
  lineTotalPaise: rupees(inclusive) * qty,
  gstRatePercent: rate,
});

/* --- inclusive split ---------------------------------------------------- */
{
  const { taxableValuePaise, taxPaise } = splitInclusive(rupees(105), 5);
  assert.equal(taxableValuePaise, rupees(100), '₹105 inclusive of 5% has a ₹100 taxable value');
  assert.equal(taxPaise, rupees(5));
  assert.equal(taxableValuePaise + taxPaise, rupees(105), 'the parts add back exactly');
}

// The parts must add back for every amount, not just round ones — this is
// why tax is derived by subtraction rather than computed independently.
for (let p = 1; p <= 2000; p++) {
  const { taxableValuePaise, taxPaise } = splitInclusive(p, 5);
  assert.equal(taxableValuePaise + taxPaise, p, `split of ${p} paise must be exact`);
}

/* --- intra-state: CGST + SGST, never IGST ------------------------------ */
{
  const inv = computeInvoice([line(110, 2)], 'Karnataka', 'Karnataka');
  assert.equal(inv.intraState, true);
  assert.ok(inv.cgstPaise > 0 && inv.sgstPaise > 0);
  assert.equal(inv.igstPaise, 0, 'intra-state must not produce IGST');
  assert.equal(inv.cgstPaise + inv.sgstPaise, rupees(220) - inv.taxableValuePaise, 'halves sum to the tax');
  assert.equal(inv.totalPaise, rupees(220), 'the invoice total equals what was charged');
}

/* --- inter-state: IGST, never CGST/SGST -------------------------------- */
{
  const inv = computeInvoice([line(110, 2)], 'Karnataka', 'Tamil Nadu');
  assert.equal(inv.intraState, false);
  assert.equal(inv.cgstPaise, 0);
  assert.equal(inv.sgstPaise, 0);
  assert.ok(inv.igstPaise > 0);
  assert.equal(inv.totalPaise, rupees(220));
}

/* --- the two must produce the same total tax --------------------------- */
{
  const intra = computeInvoice([line(110, 3)], 'Karnataka', 'Karnataka');
  const inter = computeInvoice([line(110, 3)], 'Karnataka', 'Kerala');
  assert.equal(
    intra.cgstPaise + intra.sgstPaise,
    inter.igstPaise,
    'the same sale is taxed the same amount either way — only the split differs',
  );
}

/* --- state matching ignores case and spacing --------------------------- */
assert.equal(computeInvoice([line(110)], 'Karnataka', ' karnataka ').intraState, true);

/* --- shipping and discount are distributed, and totals still reconcile -- */
{
  const inv = computeInvoice(
    [line(250, 1), line(110, 1)],
    'Karnataka', 'Karnataka',
    rupees(60),   // shipping
    rupees(36),   // discount
  );
  const charged = rupees(250) + rupees(110) + rupees(60) - rupees(36);
  assert.equal(inv.totalPaise, charged, 'invoice total must equal the amount actually charged');
  assert.equal(
    inv.taxableValuePaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise,
    charged,
    'taxable value plus tax reconciles to the total',
  );
}

/* --- mixed GST rates across lines -------------------------------------- */
{
  const inv = computeInvoice([line(100, 1, 5), line(100, 1, 12)], 'Karnataka', 'Karnataka');
  assert.equal(inv.totalPaise, rupees(200));
  assert.ok(inv.taxableValuePaise < rupees(200), 'different rates still yield a smaller taxable value');
}

/* --- financial year boundaries ----------------------------------------- */
assert.equal(financialYearOf(new Date('2026-04-01T00:00:00Z')), '2026-27', 'FY starts 1 April');
assert.equal(financialYearOf(new Date('2027-03-31T00:00:00Z')), '2026-27', 'and ends 31 March');
assert.equal(financialYearOf(new Date('2026-03-31T00:00:00Z')), '2025-26');
assert.equal(financialYearOf(new Date('2026-09-18T00:00:00Z')), '2026-27');

assert.equal(formatInvoiceNumber('2026-27', 1), 'SV/2026-27/00001');

/* --- amount in words, Indian grouping ---------------------------------- */
assert.equal(rupeesInWords(rupees(110)), 'One Hundred Ten Rupees Only');
assert.equal(rupeesInWords(11050), 'One Hundred Ten Rupees and Fifty Paise Only');
assert.equal(rupeesInWords(rupees(100000)), 'One Lakh Rupees Only');
assert.equal(rupeesInWords(rupees(10000000)), 'One Crore Rupees Only');
assert.equal(rupeesInWords(0), 'Zero Rupees Only');

console.log('gst.ts: all assertions passed');
