/**
 * Refunds.
 *
 * Owner-only once the admin panel exists. Always addressed by order number,
 * never by a payment id from a caller.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema.js';
import { refundPayment } from '../lib/razorpay.js';
import { transitionOrder } from './order-status.js';
import { ApiError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export interface RefundInput {
  orderNumber: string;
  /** Omit for a full refund; paise for a partial one. */
  amountPaise?: number;
  /** Damaged goods do not go back on the shelf. */
  restock?: boolean;
  reason: string;
}

export async function refundOrder(input: RefundInput) {
  const db = getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, input.orderNumber))
    .limit(1);

  if (!order) throw notFound('No such order.');
  if (order.paymentStatus === 'refunded') {
    return { orderNumber: order.orderNumber, alreadyRefunded: true };
  }

  if (input.amountPaise !== undefined) {
    if (input.amountPaise <= 0 || input.amountPaise > order.totalPaise) {
      throw new ApiError(400, 'INVALID_REFUND_AMOUNT', 'A refund cannot exceed the order total.');
    }
  }

  const isPartial = input.amountPaise !== undefined && input.amountPaise < order.totalPaise;

  if (order.paymentMethod === 'cod') {
    // COD refunds are a manual bank transfer; the admin records the UTR
    // against the order afterwards. See docs/PAYMENTS.md §9.
    logger.warn(
      { orderNumber: order.orderNumber, reason: input.reason },
      'COD refund requires a manual transfer',
    );
  } else {
    if (!order.razorpayPaymentId) {
      throw new ApiError(409, 'NOT_PAID', 'That order has no captured payment to refund.');
    }
    await refundPayment(order.razorpayPaymentId, input.amountPaise);
  }

  await db
    .update(orders)
    .set({
      paymentStatus: isPartial ? 'partially_refunded' : 'refunded',
      adminNotes: input.reason,
    })
    .where(eq(orders.id, order.id));

  // Full refunds move the order to a terminal state; partial ones leave it
  // where it is, because the rest of the order still stands.
  if (!isPartial) {
    const from = order.status;
    if (from !== 'refunded' && from !== 'failed') {
      const via = from === 'delivered' ? 'returned' : from === 'shipped' ? 'rto' : 'cancelled';
      if (from !== via) await transitionOrder(order.orderNumber, via, { restock: false });
      await transitionOrder(order.orderNumber, 'refunded', { restock: input.restock ?? true });
    }
  }

  logger.info(
    { orderNumber: order.orderNumber, partial: isPartial, reason: input.reason },
    'order refunded',
  );
  return { orderNumber: order.orderNumber, partial: isPartial, alreadyRefunded: false };
}
