/**
 * Abandoned cart recovery.
 *
 * The guards are the feature. Sending the message is four lines; deciding
 * whether it is legal to send is the rest of the file.
 *
 * An abandoned-cart nudge is PROMOTIONAL in India, not transactional. That
 * means all of the following must hold, and each is checked here rather than
 * trusted to whoever wires up the job:
 *
 *   - marketing consent on record for that number (DPDP Act)
 *   - inside 09:00-21:00 IST (TRAI TCCCPA restricts promotional hours)
 *   - a registered template on a registered header (TRAI DLT)
 *   - the cart is not already recovered
 *   - no reminder has ever been sent for it — one per cart, not one per sweep
 *
 * Unconfigured, nothing sends and the reason is recorded. A provider that is
 * not set up must not stop the shop working. See docs/COMPLIANCE.md.
 */
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { abandonedCarts } from '../db/schema.js';
import { hasMarketingConsent } from './consent.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

/** How long a cart sits untouched before it counts as abandoned. */
export const ABANDONED_AFTER_MS = 4 * 60 * 60 * 1000;

/** TRAI's promotional window, in IST. */
export const SEND_WINDOW_IST = { from: 9, to: 21 } as const;

export interface CartLine { productSlug: string; weight: string; quantity: number }

export type SkipReason =
  | 'no_consent'
  | 'outside_hours'
  | 'not_configured'
  | 'already_reminded'
  | 'recovered';

/**
 * IST regardless of where the server runs. A Railway instance in Singapore
 * must not decide an Indian customer's quiet hours from its own clock.
 */
export function istHour(now: Date): number {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60_000);
  return ist.getUTCHours();
}

export function withinSendWindow(now: Date): boolean {
  const h = istHour(now);
  return h >= SEND_WINDOW_IST.from && h < SEND_WINDOW_IST.to;
}

export const recoveryConfigured = Boolean(
  env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_CART_TEMPLATE,
);

/** Upsert on phone: one open cart per person, refreshed as they change it. */
export async function recordAbandonedCart(
  phone: string,
  items: CartLine[],
  valuePaise: number,
): Promise<void> {
  if (items.length === 0) return;
  const db = getDb();
  await db
    .insert(abandonedCarts)
    .values({ phone, items, valuePaise })
    .onConflictDoUpdate({
      target: abandonedCarts.phone,
      set: {
        items,
        valuePaise,
        updatedAt: new Date(),
        // Editing the cart re-opens it: a previous reminder should not block
        // a future one for what is effectively a new cart.
        remindedAt: null,
        skippedReason: null,
        recoveredAt: null,
        recoveredOrderNumber: null,
      },
    });
}

/** Called when an order is placed. Stops any pending reminder. */
export async function markRecovered(phone: string, orderNumber: string): Promise<void> {
  const db = getDb();
  await db
    .update(abandonedCarts)
    .set({ recoveredAt: new Date(), recoveredOrderNumber: orderNumber })
    .where(and(eq(abandonedCarts.phone, phone), isNull(abandonedCarts.recoveredAt)));
}

export interface EligibilityInput {
  recoveredAt: Date | null;
  remindedAt: Date | null;
  now: Date;
  consent: boolean;
}

/**
 * The whole decision, as one pure function, so the rules can be tested
 * without a database, a clock or a provider.
 */
export function eligibility(input: EligibilityInput): { send: boolean; reason?: SkipReason } {
  if (input.recoveredAt) return { send: false, reason: 'recovered' };
  if (input.remindedAt) return { send: false, reason: 'already_reminded' };
  if (!input.consent) return { send: false, reason: 'no_consent' };
  if (!withinSendWindow(input.now)) return { send: false, reason: 'outside_hours' };
  if (!recoveryConfigured) return { send: false, reason: 'not_configured' };
  return { send: true };
}

export interface SweepResult { considered: number; sent: number; skipped: Record<string, number> }

/**
 * Finds carts due a reminder and decides on each. Returns what it did rather
 * than logging and forgetting, so the job handler can report it.
 *
 * Deliberately does not send here — the caller enqueues a notification, so a
 * provider failure retries on the queue's existing backoff instead of losing
 * the reminder.
 */
export async function sweepAbandonedCarts(
  now: Date = new Date(),
  send: (phone: string, items: CartLine[]) => Promise<void>,
): Promise<SweepResult> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - ABANDONED_AFTER_MS);

  const rows = await db
    .select()
    .from(abandonedCarts)
    .where(
      and(
        isNull(abandonedCarts.recoveredAt),
        isNull(abandonedCarts.remindedAt),
        lt(abandonedCarts.updatedAt, cutoff),
      ),
    )
    .limit(200);

  const result: SweepResult = { considered: rows.length, sent: 0, skipped: {} };

  for (const row of rows) {
    const consent = await hasMarketingConsent(row.phone);
    const verdict = eligibility({
      recoveredAt: row.recoveredAt, remindedAt: row.remindedAt, now, consent,
    });

    if (!verdict.send) {
      result.skipped[verdict.reason!] = (result.skipped[verdict.reason!] ?? 0) + 1;
      // 'outside_hours' is not recorded: it is temporary, and writing it would
      // make the cart look permanently handled when the sweep runs at 22:00.
      if (verdict.reason !== 'outside_hours') {
        await db.update(abandonedCarts)
          .set({ skippedReason: verdict.reason! })
          .where(eq(abandonedCarts.id, row.id));
      }
      continue;
    }

    await send(row.phone, row.items as CartLine[]);
    await db.update(abandonedCarts)
      .set({ remindedAt: now, skippedReason: null })
      .where(eq(abandonedCarts.id, row.id));
    result.sent += 1;
  }

  // No phone numbers in the log — hard rule 6. Counts only.
  logger.info({ ...result }, 'abandoned cart sweep');
  return result;
}

/** Erasure has to reach this table too. Called from consent.erasePersonalData. */
export async function eraseAbandonedCarts(phone: string): Promise<number> {
  const db = getDb();
  const r = await db.delete(abandonedCarts).where(eq(abandonedCarts.phone, phone));
  return (r as unknown as { rowCount?: number }).rowCount ?? 0;
}
