/**
 * Nightly reconciliation. Trust nothing.
 *
 * Two jobs, both of which exist because payment systems drift:
 *
 *   sweepStaleOrders   releases stock held by orders that never paid
 *   reconcilePayments  compares Razorpay's record against ours
 *
 * The highest-severity finding is a payment with no order: money taken,
 * nothing recorded. It is almost always a webhook that failed while the
 * customer's tab was closed. See docs/PAYMENTS.md §10.
 *
 * Run: npm run job:reconcile -w backend
 */
import { and, eq, lt, gte, isNotNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema.js';
import { fetchPayment, listPayments } from '../lib/razorpay.js';
import { failOrder } from '../services/orders.js';
import { settlePayment } from '../services/payments.js';
import { razorpayConfigured } from '../lib/env.js';
import { logger } from '../lib/logger.js';

/** How long an unpaid order may hold stock before it is released. */
const STALE_AFTER_MINUTES = 30;

export interface ReconciliationReport {
  staleReleased: string[];
  staleRecovered: string[];
  paymentsWithoutOrder: string[];
  amountMismatches: { orderNumber: string; expected: number; received: number }[];
  checkedPayments: number;
}

/**
 * Release stock held by orders that never completed payment.
 *
 * Before failing one, ask Razorpay whether it actually paid: a customer who
 * closed the tab mid-payment has a real payment and a pending order, and
 * failing that order would restock goods that were sold.
 */
export async function sweepStaleOrders(report: ReconciliationReport) {
  const db = getDb();
  const cutoff = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);

  const stale = await db
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, cutoff)));

  for (const order of stale) {
    if (razorpayConfigured && order.razorpayOrderId) {
      try {
        const found = await findCapturedPaymentFor(order.razorpayOrderId);
        if (found) {
          await settlePayment({
            razorpayOrderId: order.razorpayOrderId,
            razorpayPaymentId: found.id,
            amountPaise: found.amount,
            source: 'webhook',
          });
          report.staleRecovered.push(order.orderNumber);
          continue;
        }
      } catch (err) {
        logger.error({ err, orderNumber: order.orderNumber }, 'stale order check failed');
        continue; // leave it pending rather than risk restocking a paid order
      }
    }

    await failOrder(order.orderNumber, `no payment within ${STALE_AFTER_MINUTES} minutes`);
    report.staleReleased.push(order.orderNumber);
  }
}

async function findCapturedPaymentFor(razorpayOrderId: string) {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const { items } = await listPayments(since, Math.floor(Date.now() / 1000));
  return items.find((p) => p.order_id === razorpayOrderId && p.status === 'captured') ?? null;
}

/** Compare yesterday's Razorpay payments against our orders. */
export async function reconcilePayments(report: ReconciliationReport) {
  if (!razorpayConfigured) {
    logger.warn('razorpay not configured — payment reconciliation skipped');
    return;
  }

  const db = getDb();
  const to = Math.floor(Date.now() / 1000);
  const from = to - 24 * 3600;

  const { items } = await listPayments(from, to);
  report.checkedPayments = items.length;

  for (const payment of items) {
    if (payment.status !== 'captured') continue;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.razorpayPaymentId, payment.id))
      .limit(1);

    if (!order) {
      // Money taken, nothing recorded. Highest severity.
      report.paymentsWithoutOrder.push(payment.id);
      logger.error({ paymentId: payment.id, amount: payment.amount }, 'payment has no matching order');
      continue;
    }

    if (order.totalPaise !== payment.amount) {
      report.amountMismatches.push({
        orderNumber: order.orderNumber,
        expected: order.totalPaise,
        received: payment.amount,
      });
      logger.error(
        { orderNumber: order.orderNumber, expected: order.totalPaise, received: payment.amount },
        'payment amount mismatch',
      );
    }
  }

  // Orders we believe are paid but Razorpay has no record of — a verification
  // bug, and serious.
  const paidOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, 'paid'),
        isNotNull(orders.razorpayPaymentId),
        gte(orders.createdAt, new Date(from * 1000)),
      ),
    );

  for (const order of paidOrders) {
    try {
      await fetchPayment(order.razorpayPaymentId!);
    } catch {
      logger.error({ orderNumber: order.orderNumber }, 'order marked paid but provider has no such payment');
    }
  }
}

export async function runReconciliation(): Promise<ReconciliationReport> {
  const report: ReconciliationReport = {
    staleReleased: [], staleRecovered: [], paymentsWithoutOrder: [],
    amountMismatches: [], checkedPayments: 0,
  };

  await sweepStaleOrders(report);
  await reconcilePayments(report);

  const clean =
    report.paymentsWithoutOrder.length === 0 && report.amountMismatches.length === 0;

  // Reported even when clean. A job that only speaks on bad days is
  // indistinguishable from a job that has been broken for three weeks.
  logger.info({ ...report, clean }, 'reconciliation complete');
  return report;
}
