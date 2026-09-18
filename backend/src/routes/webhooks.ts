/**
 * Razorpay webhooks.
 *
 * Mounted with express.raw(), BEFORE express.json(). Parsing and
 * re-serialising the body changes its bytes and breaks the HMAC — proven in
 * payments.test.ts. See docs/PAYMENTS.md §6.
 */
import { Router, raw } from 'express';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';
import {
  verifyWebhookSignature, recordWebhookEvent, markWebhookProcessed, settlePayment,
} from '../services/payments.js';
import * as ordersService from '../services/orders.js';

export const webhooksRouter = Router();

webhooksRouter.post(
  '/webhooks/razorpay',
  raw({ type: 'application/json', limit: '256kb' }),
  async (req, res) => {
    const signature = req.header('x-razorpay-signature') ?? '';
    const rawBody = req.body as Buffer;

    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      logger.error('webhook received but RAZORPAY_WEBHOOK_SECRET is not set');
      res.status(503).json({ error: 'not configured' });
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)) {
      logger.warn({ requestId: req.id }, 'webhook signature verification failed');
      res.status(400).json({ error: 'invalid signature' });
      return;
    }

    let event: {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
    };
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'invalid json' });
      return;
    }

    // Razorpay's own delivery id, so a redelivery is recognised as the same
    // event rather than a new one.
    const eventId = req.header('x-razorpay-event-id') ?? `${event.event}:${event.payload?.payment?.entity?.id}`;
    const eventType = event.event ?? 'unknown';

    const isNew = await recordWebhookEvent('razorpay', eventId, eventType, event);
    if (!isNew) {
      // Already seen. 200, because retrying a successfully stored event is
      // pure noise.
      res.json({ status: 'duplicate' });
      return;
    }

    try {
      const entity = event.payload?.payment?.entity;
      if (eventType === 'payment.captured' && entity?.order_id && entity?.id) {
        await settlePayment({
          razorpayOrderId: entity.order_id,
          razorpayPaymentId: entity.id,
          amountPaise: entity.amount,
          source: 'webhook',
        });
      } else if (eventType === 'payment.failed' && entity?.order_id) {
        await ordersService.failOrder(entity.order_id, 'payment.failed');
      }
      await markWebhookProcessed('razorpay', eventId);
    } catch (err) {
      // Record the failure but still acknowledge: the event is stored and can
      // be replayed. A non-200 just makes Razorpay retry into the same error.
      logger.error({ err, eventId, eventType }, 'webhook processing failed');
      await markWebhookProcessed('razorpay', eventId, String(err));
    }

    res.json({ status: 'ok' });
  },
);
