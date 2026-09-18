/**
 * Job handlers.
 *
 * Every one must be idempotent: the queue is at-least-once, so a handler can
 * run twice after a crash between doing the work and marking it done.
 */
import { eq } from 'drizzle-orm';
import { formatPaise } from '@sv/shared';
import { getDb } from '../db/client.js';
import { orders, orderItems } from '../db/schema.js';
import { sendWhatsApp, sendEmail } from '../lib/notify.js';
import { bookShipment, shiprocketConfigured } from '../lib/shiprocket.js';
import { logger } from '../lib/logger.js';
import { enqueue, type QueueName } from '../lib/queue.js';

type Handler = (payload: Record<string, unknown>) => Promise<void>;

async function loadOrder(orderNumber: string) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order) throw new Error(`order ${orderNumber} not found`);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

const orderSummary = (
  order: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
) =>
  items.map((i) => `• ${i.productName} (${i.weight}) × ${i.quantity} — ${formatPaise(i.lineTotalPaise)}`).join('\n') +
  `\n\nTotal: ${formatPaise(order.totalPaise)}` +
  (order.paymentMethod === 'cod' ? '\nPayable on delivery.' : '\nPaid.');

const handlers: Record<string, Handler> = {
  /** Sent once an order is confirmed. Deduped on the order number. */
  'order.confirmation': async (payload) => {
    const { order, items } = await loadOrder(String(payload.orderNumber));

    const message =
      `Namaste ${order.customerName}!\n\n` +
      `Your S V Home Products order ${order.orderNumber} is confirmed and is being prepared in our family kitchen.\n\n` +
      orderSummary(order, items) +
      `\n\nTrack it any time: ${process.env.APP_URL ?? ''}/order/${order.orderNumber}`;

    const whatsapp = await sendWhatsApp(order.phone, message);

    if (order.email) {
      await sendEmail(order.email, `Order ${order.orderNumber} confirmed`, message);
    }

    logger.info(
      { orderNumber: order.orderNumber, whatsapp: whatsapp.simulated ? 'simulated' : 'sent' },
      'confirmation processed',
    );
  },

  /** Sent when an AWB is assigned. */
  'order.shipped': async (payload) => {
    const { order } = await loadOrder(String(payload.orderNumber));

    const message =
      `Namaste ${order.customerName}!\n\n` +
      `Your order ${order.orderNumber} has been dispatched.\n` +
      (order.courier ? `Courier: ${order.courier}\n` : '') +
      (order.trackingNumber ? `Tracking: ${order.trackingNumber}\n` : '') +
      `\nTrack it: ${process.env.APP_URL ?? ''}/order/${order.orderNumber}`;

    await sendWhatsApp(order.phone, message);
    if (order.email) await sendEmail(order.email, `Order ${order.orderNumber} dispatched`, message);
  },

  /**
   * Book the shipment with the courier.
   *
   * Idempotent on the order already carrying a tracking number: a retry after
   * a crash must not create a second pickup.
   */
  'shipment.book': async (payload) => {
    const orderNumber = String(payload.orderNumber);
    const { order, items } = await loadOrder(orderNumber);

    if (order.trackingNumber) {
      logger.info({ orderNumber }, 'shipment already booked, skipping');
      return;
    }

    if (!shiprocketConfigured) {
      // Not an error: the order stands and is dispatched by hand.
      logger.warn({ orderNumber }, 'courier not configured — book this shipment manually');
      return;
    }

    const booking = await bookShipment({
      orderNumber: order.orderNumber,
      placedAt: order.createdAt,
      customerName: order.customerName,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      phone: order.phone,
      email: order.email,
      paymentMethod: order.paymentMethod,
      totalPaise: order.totalPaise,
      items: items.map((i) => ({
        name: i.productName, sku: i.sku, quantity: i.quantity, unitPricePaise: i.unitPricePaise,
      })),
    });

    const db = getDb();
    await db
      .update(orders)
      .set({ trackingNumber: booking.awb, courier: booking.courier })
      .where(eq(orders.id, order.id));

    if (booking.awb) {
      await enqueue('notifications', { type: 'order.shipped', orderNumber }, {
        dedupeKey: `shipped:${orderNumber}`,
      });
    }

    logger.info({ orderNumber, awb: booking.awb, courier: booking.courier }, 'shipment booked');
  },
};

export async function runJob(queue: QueueName, payload: Record<string, unknown>): Promise<void> {
  const type = String(payload.type ?? '');
  const handler = handlers[type];
  if (!handler) throw new Error(`no handler for job type "${type}" on queue ${queue}`);
  await handler(payload);
}

export const knownJobTypes = Object.keys(handlers);
