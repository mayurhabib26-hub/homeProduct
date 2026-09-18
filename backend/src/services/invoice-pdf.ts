/**
 * Tax invoice PDF.
 *
 * Contents are prescribed by the GST rules, not by taste: seller name,
 * address and GSTIN; a sequential invoice number and date; buyer details;
 * place of supply; per-item description, HSN, quantity, rate and taxable
 * value; the CGST/SGST or IGST split; the total in figures and words; and the
 * FSSAI licence. See docs/COMPLIANCE.md §4.
 */
import PDFDocument from 'pdfkit';
import { formatPaise } from '@sv/shared';
import { rupeesInWords, type InvoiceLine } from './gst.js';
import { env } from '../lib/env.js';
import type { invoices, orders } from '../db/schema.js';

type Invoice = typeof invoices.$inferSelect;
type Order = typeof orders.$inferSelect;

export function renderInvoicePdf(invoice: Invoice, order: Order): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const lines = invoice.lines as InvoiceLine[];
  const L = 48;
  const R = 547;

  doc.fontSize(16).text('TAX INVOICE', { align: 'center' });
  doc.moveDown(0.6);

  // --- seller -------------------------------------------------------------
  doc.fontSize(11).text(env.SELLER_LEGAL_NAME, L);
  doc.fontSize(8).fillColor('#444');
  if (env.SELLER_ADDRESS) doc.text(env.SELLER_ADDRESS, { width: 260 });
  doc.text(`GSTIN: ${env.SELLER_GSTIN ?? '—'}`);
  doc.text(`FSSAI Licence: ${env.FSSAI_LICENCE ?? '—'}`);
  doc.fillColor('#000');

  // --- invoice meta, right aligned ---------------------------------------
  const metaTop = 96;
  doc.fontSize(8).fillColor('#444');
  doc.text('Invoice No.', 380, metaTop, { width: 80 });
  doc.text('Invoice Date', 380, metaTop + 14, { width: 80 });
  doc.text('Order No.', 380, metaTop + 28, { width: 80 });
  doc.text('Place of Supply', 380, metaTop + 42, { width: 80 });
  doc.fillColor('#000');
  doc.text(invoice.invoiceNumber, 465, metaTop, { width: 82, align: 'right' });
  doc.text(invoice.issuedAt.toLocaleDateString('en-IN'), 465, metaTop + 14, { width: 82, align: 'right' });
  doc.text(order.orderNumber, 465, metaTop + 28, { width: 82, align: 'right' });
  doc.text(invoice.placeOfSupply, 465, metaTop + 42, { width: 82, align: 'right' });

  // --- buyer --------------------------------------------------------------
  doc.moveDown(3);
  let y = 170;
  doc.fontSize(8).fillColor('#444').text('BILL TO', L, y);
  doc.fillColor('#000').fontSize(10).text(order.customerName, L, y + 12);
  doc.fontSize(8).fillColor('#444').text(
    `${order.address}${order.landmark ? `, ${order.landmark}` : ''}\n` +
      `${order.city}, ${order.state} — ${order.pincode}\nPhone: ${order.phone}`,
    L, y + 26, { width: 260 },
  );
  doc.fillColor('#000');

  // --- items --------------------------------------------------------------
  y = 240;
  const cols = { desc: L, hsn: 250, qty: 300, rate: 340, taxable: 400, tax: 460, total: 500 };
  doc.fontSize(7).fillColor('#444');
  doc.text('DESCRIPTION', cols.desc, y);
  doc.text('HSN', cols.hsn, y);
  doc.text('QTY', cols.qty, y);
  doc.text('RATE', cols.rate, y);
  doc.text('TAXABLE', cols.taxable, y);
  doc.text('TAX', cols.tax, y);
  doc.text('TOTAL', cols.total, y, { width: 47, align: 'right' });
  doc.moveTo(L, y + 10).lineTo(R, y + 10).strokeColor('#ccc').stroke();
  doc.fillColor('#000');

  y += 16;
  for (const line of lines) {
    const tax = line.cgstPaise + line.sgstPaise + line.igstPaise;
    doc.fontSize(8);
    doc.text(line.description, cols.desc, y, { width: 195 });
    doc.text(line.hsnCode ?? '—', cols.hsn, y);
    doc.text(String(line.quantity), cols.qty, y);
    doc.text(`${line.gstRatePercent}%`, cols.rate, y);
    doc.text(formatPaise(line.taxableValuePaise), cols.taxable, y);
    doc.text(formatPaise(tax), cols.tax, y);
    doc.text(formatPaise(line.taxableValuePaise + tax), cols.total, y, { width: 47, align: 'right' });
    y += Math.max(14, doc.heightOfString(line.description, { width: 195 }));
  }

  doc.moveTo(L, y + 4).lineTo(R, y + 4).strokeColor('#ccc').stroke();
  y += 14;

  // --- totals -------------------------------------------------------------
  const row = (label: string, value: string, bold = false) => {
    doc.fontSize(bold ? 10 : 8).fillColor(bold ? '#000' : '#444');
    doc.text(label, 340, y, { width: 110 });
    doc.fillColor('#000').text(value, 460, y, { width: 87, align: 'right' });
    y += bold ? 18 : 13;
  };

  row('Taxable value', formatPaise(invoice.taxableValuePaise));
  if (invoice.intraState) {
    row('CGST', formatPaise(invoice.cgstPaise));
    row('SGST', formatPaise(invoice.sgstPaise));
  } else {
    row('IGST', formatPaise(invoice.igstPaise));
  }
  row('Total', formatPaise(invoice.totalPaise), true);

  doc.fontSize(8).fillColor('#444');
  doc.text(`Amount in words: ${rupeesInWords(invoice.totalPaise)}`, L, y + 6, { width: 460 });

  doc.fontSize(7).fillColor('#666');
  doc.text(
    'All prices are inclusive of GST. This is a computer-generated invoice.' +
      (env.GRIEVANCE_EMAIL ? `\nGrievances: ${env.GRIEVANCE_OFFICER ?? ''} ${env.GRIEVANCE_EMAIL}` : ''),
    L, 760, { width: 460 },
  );

  doc.end();
  return done;
}
