/**
 * Tax invoice issuance.
 *
 * One invoice per order, numbered sequentially within the financial year with
 * no gaps. The sequence comes from the database under a lock, never from a
 * counter in application memory — two workers issuing at once must not
 * produce the same number, and a crash must not leave a hole.
 *
 * See docs/COMPLIANCE.md §4.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, orderItems, invoices, products } from '../db/schema.js';
import { computeInvoice, financialYearOf, formatInvoiceNumber, type InvoiceLineInput } from './gst.js';
import { env, invoicingReady, missingComplianceValues } from '../lib/env.js';
import { ApiError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export async function issueInvoice(orderNumber: string) {
  if (!invoicingReady) {
    throw new ApiError(
      503,
      'INVOICING_NOT_CONFIGURED',
      `Cannot issue an invoice: ${missingComplianceValues.join(', ')} not set.`,
    );
  }

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) throw notFound('No such order.');

  // One invoice per order, enforced by a unique index as well as this check.
  const [existing] = await db.select().from(invoices).where(eq(invoices.orderId, order.id)).limit(1);
  if (existing) return existing;

  if (order.paymentStatus !== 'paid' && order.paymentMethod !== 'cod') {
    throw new ApiError(409, 'NOT_INVOICEABLE', 'An unpaid order cannot be invoiced.');
  }

  const items = await db
    .select({ item: orderItems, gstRate: products.gstRatePercent })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, order.id));

  const lines: InvoiceLineInput[] = items.map(({ item, gstRate }) => ({
    description: `${item.productName} (${item.weight})`,
    hsnCode: item.hsnCode,
    quantity: item.quantity,
    unitPricePaise: item.unitPricePaise,
    lineTotalPaise: item.lineTotalPaise,
    gstRatePercent: gstRate ?? 5,
  }));

  const computed = computeInvoice(
    lines,
    env.SELLER_STATE,
    order.state,
    order.shippingPaise,
    order.discountPaise,
  );

  // The invoice must reconcile to what the customer actually paid. If it does
  // not, something is wrong with pricing or tax and a human must look before
  // a document goes out.
  if (computed.totalPaise !== order.totalPaise) {
    logger.error(
      { orderNumber, invoiceTotal: computed.totalPaise, orderTotal: order.totalPaise },
      'invoice does not reconcile to the order total',
    );
    throw new ApiError(500, 'INVOICE_MISMATCH', 'Invoice could not be reconciled. Please contact support.');
  }

  const now = new Date();
  const fy = financialYearOf(now);

  const created = await db.transaction(async (tx) => {
    /**
     * Next sequence for this financial year, taken under a transaction-scoped
     * advisory lock keyed on the year. Two concurrent issues serialise rather
     * than racing to the same number.
     */
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'invoice:' + fy}))`);

    const result = await tx.execute(sql`
      select coalesce(max(sequence), 0) + 1 as next
        from invoices where financial_year = ${fy}`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ next: number }>;
    const sequence = Number(rows[0]!.next);

    const [row] = await tx
      .insert(invoices)
      .values({
        orderId: order.id,
        invoiceNumber: formatInvoiceNumber(fy, sequence),
        financialYear: fy,
        sequence,
        placeOfSupply: computed.placeOfSupply,
        intraState: computed.intraState,
        taxableValuePaise: computed.taxableValuePaise,
        cgstPaise: computed.cgstPaise,
        sgstPaise: computed.sgstPaise,
        igstPaise: computed.igstPaise,
        totalPaise: computed.totalPaise,
        lines: computed.lines,
      })
      .returning();

    return row;
  });

  logger.info(
    { orderNumber, invoiceNumber: created.invoiceNumber, intraState: computed.intraState },
    'invoice issued',
  );
  return created;
}

export async function getInvoiceForOrder(orderNumber: string) {
  const db = getDb();
  const [row] = await db
    .select({ invoice: invoices, order: orders })
    .from(invoices)
    .innerJoin(orders, eq(orders.id, invoices.orderId))
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!row) throw notFound('No invoice for that order.');
  return row;
}
