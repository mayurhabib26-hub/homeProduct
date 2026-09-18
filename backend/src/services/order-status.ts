/**
 * The order state machine.
 *
 * Transitions are enforced, not trusted. An illegal one (delivered -> pending)
 * throws rather than quietly corrupting an order's history. Every change also
 * decides whether stock moves — and stock only ever moves through stock.ts.
 *
 * See docs/DATABASE.md §3 for the diagram.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, orderItems } from '../db/schema.js';
import { restoreStock } from './stock.js';
import { ApiError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueue } from '../lib/queue.js';

export type OrderStatus =
  | 'pending' | 'confirmed' | 'packed' | 'shipped'
  | 'delivered' | 'cancelled' | 'failed' | 'rto' | 'returned' | 'refunded';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'failed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'rto'],
  delivered: ['returned'],
  rto: ['refunded'],
  returned: ['refunded'],
  cancelled: ['refunded'],
  failed: [],
  refunded: [],
};

/**
 * Statuses that hand stock back.
 *
 * A delivered order that is returned restocks by default; damage is the
 * exception an admin chooses, because a damaged packet does not go back on
 * the shelf. See docs/PAYMENTS.md §9.
 */
const RESTOCKING: OrderStatus[] = ['cancelled', 'failed', 'rto', 'returned'];

const TIMESTAMP_FOR: Partial<Record<OrderStatus, 'shippedAt' | 'deliveredAt' | 'cancelledAt'>> = {
  shipped: 'shippedAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt',
};

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from]?.includes(to) ?? false;

export const allowedFrom = (from: OrderStatus): OrderStatus[] => TRANSITIONS[from] ?? [];

export interface TransitionOptions {
  /** Return-to-origin and damaged returns should not restock. */
  restock?: boolean;
  trackingNumber?: string;
  courier?: string;
  adminNote?: string;
}

export async function transitionOrder(
  orderNumber: string,
  to: OrderStatus,
  options: TransitionOptions = {},
) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) throw notFound('No such order.');

  const from = order.status as OrderStatus;
  if (from === to) return { orderNumber, status: to, unchanged: true };

  if (!canTransition(from, to)) {
    throw new ApiError(
      409,
      'ILLEGAL_TRANSITION',
      `An order that is ${from} cannot become ${to}.`,
      { from, to, allowed: allowedFrom(from) },
    );
  }

  const shouldRestock = options.restock ?? RESTOCKING.includes(to);

  await db.transaction(async (tx) => {
    if (shouldRestock) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      await restoreStock(
        tx as unknown as typeof db,
        items
          .filter((i) => i.variantId !== null)
          .map((i) => ({ variantId: i.variantId!, quantity: i.quantity })),
      );
    }

    const stamp = TIMESTAMP_FOR[to];
    await tx
      .update(orders)
      .set({
        status: to,
        ...(stamp ? { [stamp]: new Date() } : {}),
        ...(options.trackingNumber ? { trackingNumber: options.trackingNumber } : {}),
        ...(options.courier ? { courier: options.courier } : {}),
        ...(options.adminNote ? { adminNotes: options.adminNote } : {}),
      })
      .where(eq(orders.id, order.id));
  });

  if (to === 'packed') {
    await enqueue('fulfilment',
      { type: 'shipment.book', orderNumber },
      { dedupeKey: `book:${orderNumber}` });
  }

  // Only when an AWB actually exists — a "dispatched" message with no
  // tracking number is worse than no message.
  if (to === 'shipped' && options.trackingNumber) {
    await enqueue('notifications',
      { type: 'order.shipped', orderNumber },
      { dedupeKey: `shipped:${orderNumber}` });
  }

  logger.info({ orderNumber, from, to, restocked: shouldRestock }, 'order status changed');
  return { orderNumber, status: to, restocked: shouldRestock, unchanged: false };
}
