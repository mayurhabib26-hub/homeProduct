/**
 * Invoice numbering and reconciliation.
 * Run: npm run test:invoices -w backend   (stop the API first)
 *
 * A gap in an invoice series is a question you get asked in a GST audit, so
 * the sequence properties matter as much as the arithmetic.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { testVariantId } from '../db/test-helpers.js';
import { invoices, jobs } from '../db/schema.js';
import { createOrder } from '../services/orders.js';
import { issueInvoice } from './invoices.js';
import { financialYearOf } from './gst.js';
import { renderInvoicePdf } from './invoice-pdf.js';
import { orders } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const VARIANT = await testVariantId();
await db.execute(sql`delete from ${invoices}`);
await db.execute(sql`delete from ${jobs}`);
await db.execute(sql`update variants set stock_qty = 100 where id = ${VARIANT}`);

const place = (state: string, n: number) =>
  createOrder({
    items: [{ productSlug: 'rasam-powder', weight: '100g', quantity: 2 }],
    customer: { name: `Invoice Test ${n}`, phone: '9876543210' },
    shipping: { address: '4 Invoice Road', city: 'Somewhere', state, pincode: '560004' },
    paymentMethod: 'cod',
    idempotencyKey: `invoice-test-${n}-${Date.now()}`,
  });

/* --- sequence is gap-free and starts at 1 ------------------------------ */
const fy = financialYearOf(new Date());
const numbers: string[] = [];
for (let i = 1; i <= 5; i++) {
  const order = await place(i % 2 ? 'Karnataka' : 'Tamil Nadu', i);
  const inv = await issueInvoice(order.orderNumber);
  numbers.push(inv.invoiceNumber);
  assert.equal(inv.sequence, i, `sequence must be ${i}`);
  assert.equal(inv.financialYear, fy);
}
assert.equal(new Set(numbers).size, 5, 'every invoice number is unique');
assert.equal(numbers[0], `SV/${fy}/00001`);
assert.equal(numbers[4], `SV/${fy}/00005`);

/* --- one invoice per order, whatever the caller does ------------------- */
const repeatOrder = await place('Karnataka', 99);
const a = await issueInvoice(repeatOrder.orderNumber);
const b = await issueInvoice(repeatOrder.orderNumber);
assert.equal(a.invoiceNumber, b.invoiceNumber, 're-issuing returns the same invoice');

const count = await db.execute(sql`select count(*)::int as n from ${invoices}`);
const rows = (Array.isArray(count) ? count : (count as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
assert.equal(Number(rows[0]!.n), 6, 'no duplicate invoice was created');

/* --- concurrent issuance does not collide ------------------------------ */
const concurrentOrders = await Promise.all([100, 101, 102, 103].map((n) => place('Kerala', n)));
const issued = await Promise.all(concurrentOrders.map((o) => issueInvoice(o.orderNumber)));
const seqs = issued.map((i) => i.sequence).sort((x, y) => x - y);
assert.deepEqual(seqs, [7, 8, 9, 10], 'concurrent issues take distinct consecutive sequences');

/* --- every invoice reconciles to what was charged ---------------------- */
for (const inv of [...issued, a]) {
  const [order] = await db.select().from(orders).where(eq(orders.id, inv.orderId)).limit(1);
  assert.equal(inv.totalPaise, order!.totalPaise, `${inv.invoiceNumber} must equal the order total`);
  assert.equal(
    inv.taxableValuePaise + inv.cgstPaise + inv.sgstPaise + inv.igstPaise,
    inv.totalPaise,
    'taxable value plus tax equals the total',
  );
  // Exactly one tax regime applies.
  const intra = inv.cgstPaise > 0 || inv.sgstPaise > 0;
  const inter = inv.igstPaise > 0;
  assert.ok(intra !== inter, `${inv.invoiceNumber}: CGST/SGST and IGST must never coexist`);
}

/* --- the PDF renders --------------------------------------------------- */
const [orderForPdf] = await db.select().from(orders).where(eq(orders.id, a.orderId)).limit(1);
const pdf = await renderInvoicePdf(a, orderForPdf!);
assert.ok(pdf.length > 800, 'the PDF has content');
assert.equal(pdf.subarray(0, 4).toString(), '%PDF', 'it is a PDF');

await db.execute(sql`delete from ${invoices}`);
await db.execute(sql`update variants set stock_qty = 25 where id = ${VARIANT}`);
console.log(`invoices.ts: ${numbers.length + 5} invoices, gap-free, all reconciled, PDF ${pdf.length} bytes`);
process.exit(0);
