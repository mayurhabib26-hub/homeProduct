/**
 * Customer notifications: WhatsApp first, email second.
 *
 * WhatsApp is the primary channel for Indian D2C — reach and engagement both
 * beat email, and it is the thread the customer already associates with the
 * order. Email carries the invoice.
 *
 * Every provider is optional. Unconfigured, messages are logged rather than
 * sent, so the whole fulfilment path can be exercised before Meta business
 * verification completes. What must never happen is silent success: a
 * notification that was never sent and never reported. See docs/AUTH.md §5.
 */
import { env } from './env.js';
import { logger } from './logger.js';

export const whatsappConfigured = Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);
export const emailConfigured = Boolean(env.SMTP_URL && env.EMAIL_FROM);

export interface DeliveryResult {
  channel: 'whatsapp' | 'email';
  delivered: boolean;
  /** True when the provider is not configured — logged, not sent. */
  simulated: boolean;
  detail?: string;
}

/**
 * WhatsApp Cloud API, direct.
 *
 * Not a BSP: they wrap this in a dashboard and a CRM for a monthly fee, and
 * we are building our own admin panel. See docs/AUTH.md §5.
 */
export async function sendWhatsApp(toPhone: string, body: string): Promise<DeliveryResult> {
  if (!whatsappConfigured) {
    logger.info({ channel: 'whatsapp', simulated: true }, 'notification not sent (WhatsApp unconfigured)');
    return { channel: 'whatsapp', delivered: false, simulated: true };
  }

  const digits = toPhone.replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;

  const res = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // Thrown, not swallowed: the queue retries, and a permanent failure
    // surfaces rather than disappearing.
    throw new Error(`WhatsApp send failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  return { channel: 'whatsapp', delivered: true, simulated: false };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<DeliveryResult> {
  if (!emailConfigured) {
    logger.info({ channel: 'email', simulated: true, subject }, 'notification not sent (SMTP unconfigured)');
    return { channel: 'email', delivered: false, simulated: true };
  }

  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport(env.SMTP_URL!);
  await transport.sendMail({ from: env.EMAIL_FROM!, to, subject, text: body });
  return { channel: 'email', delivered: true, simulated: false };
}
