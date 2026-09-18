/**
 * Razorpay verification and settlement.
 *
 * A payment is marked paid only after a signature verifies. Never on the
 * strength of the client saying so — the success handler runs in the
 * customer's browser and can be called by anyone with devtools open.
 * See docs/PAYMENTS.md §6.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders, orderItems, webhookEvents } from '../db/schema.js';
import { decrementStock } from './stock.js';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { enqueue } from '../lib/queue.js';

/**
 * Constant-time comparison.
 *
 * `a === b` on a signature leaks timing information. Lengths are compared
 * first because timingSafeEqual throws on a mismatch.
 */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** HMAC over "<order_id>|<payment_id>", as Razorpay specifies. */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  const expected = createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

/**
 * HMAC over the RAW request body.
 *
 * express.json() re-serialises, which changes whitespace and key order and
 * breaks the HMAC — the single most common way this integration is gotten
 * wrong. The webhook route must be mounted with express.raw().
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string,
): boolean {
  const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

export interface SettleInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature?: string;
  amountPaise?: number;
  source: 'callback' | 'webhook';
}

/**
 * Mark an order paid and decrement its stock. Idempotent.
 *
 * Both the browser callback and the Razorpay webhook call this. Whichever
 * arrives first does the work; the second is a no-op. Roughly one payment in
 * twenty succeeds after the customer has closed the tab, so neither path is
 * optional. See docs/PAYMENTS.md §4.
 */
export async function settlePayment(input: SettleInput) {
  const db = getDb();

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.razorpayOrderId, input.razorpayOrderId))
    .limit(1);

  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', 'We could not find that payment.');

  if (order.paymentStatus === 'paid') {
    logger.info({ orderNumber: order.orderNumber, source: input.source }, 'payment already settled');
    return { orderNumber: order.orderNumber, alreadySettled: true };
  }

  // A mismatch means a bug or tampering. Either way a human looks at it
  // before anything ships. See docs/PAYMENTS.md §7.
  if (input.amountPaise !== undefined && input.amountPaise !== order.totalPaise) {
    logger.error(
      { orderNumber: order.orderNumber, expected: order.totalPaise, received: input.amountPaise },
      'payment amount mismatch — not fulfilling',
    );
    throw new ApiError(409, 'AMOUNT_MISMATCH', 'Payment amount did not match the order.');
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  await db.transaction(async (tx) => {
    await decrementStock(
      tx as unknown as typeof db,
      items.filter((i) => i.variantId !== null).map((i) => ({ variantId: i.variantId!, quantity: i.quantity })),
    );

    // Guarded on paymentStatus so two concurrent settlements cannot both
    // apply — the row count decides the winner.
    const updated = await tx.execute(sql`
      update orders
         set payment_status = 'paid',
             status = 'confirmed',
             razorpay_payment_id = ${input.razorpayPaymentId},
             razorpay_signature = ${input.signature ?? null},
             paid_at = now()
       where id = ${order.id}
         and payment_status <> 'paid'
    `);
    const affected = (updated as { rowCount?: number; count?: number }).rowCount
      ?? (updated as { count?: number }).count ?? 0;
    if (affected !== 1) throw new ApiError(409, 'ALREADY_SETTLED', 'This payment was already recorded.');
  });

  await enqueue('notifications',
    { type: 'order.confirmation', orderNumber: order.orderNumber },
    { dedupeKey: `confirmation:${order.orderNumber}` });

  await enqueue('documents',
    { type: 'invoice.issue', orderNumber: order.orderNumber },
    { dedupeKey: `invoice:${order.orderNumber}` });

  logger.info({ orderNumber: order.orderNumber, source: input.source }, 'payment settled');
  return { orderNumber: order.orderNumber, alreadySettled: false };
}

/**
 * Record a webhook before processing it.
 *
 * Returns false when the event has been seen: the unique index on
 * (provider, event_id) makes duplicate delivery a no-op at the database
 * level, not merely in application logic.
 */
export async function recordWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  const db = getDb();
  try {
    await db.insert(webhookEvents).values({ provider, eventId, eventType, payload });
    return true;
  } catch {
    logger.info({ provider, eventId }, 'duplicate webhook ignored');
    return false;
  }
}

export async function markWebhookProcessed(provider: string, eventId: string, error?: string) {
  const db = getDb();
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date(), error: error ?? null })
    .where(and(eq(webhookEvents.provider, provider), eq(webhookEvents.eventId, eventId)));
}
