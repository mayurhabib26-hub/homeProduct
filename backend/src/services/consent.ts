/**
 * Marketing consent and data erasure.
 *
 * Both exist because the DPDP Act 2023 requires them, and both are the kind
 * of thing that is painful to retrofit once there are customers.
 * See docs/COMPLIANCE.md §6.
 */
import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { marketingConsent, orders } from '../db/schema.js';
import { logger } from '../lib/logger.js';

export async function recordMarketingConsent(
  phone: string,
  email: string | undefined,
  granted: boolean,
  source: string,
  ip?: string,
) {
  const db = getDb();
  await db.insert(marketingConsent).values({
    phone, email: email ?? null, granted, source, ip: ip ?? null,
  });
}

/** The latest recorded decision for a phone number. */
export async function hasMarketingConsent(phone: string): Promise<boolean> {
  const db = getDb();
  const [latest] = await db
    .select()
    .from(marketingConsent)
    .where(eq(marketingConsent.phone, phone))
    .orderBy(desc(marketingConsent.recordedAt))
    .limit(1);
  return latest?.granted ?? false;
}

export interface ErasureResult {
  ordersAnonymised: number;
  consentRecordsRemoved: number;
}

/**
 * Erasure on request, implemented as anonymisation.
 *
 * GST requires the financial record to be kept for eight years, so the order
 * cannot simply be deleted. Name, phone, email and address are removed and
 * the money stays — which satisfies both obligations rather than choosing
 * one. Doing this by hand guarantees a missed column, so it is one action.
 */
export async function erasePersonalData(phone: string, reason: string): Promise<ErasureResult> {
  const db = getDb();

  const result = await db
    .update(orders)
    .set({
      customerName: 'Erased on request',
      phone: `erased-${Date.now().toString(36)}`,
      email: null,
      address: 'Erased on request',
      landmark: null,
      notes: null,
    })
    .where(eq(orders.phone, phone))
    .returning({ id: orders.id });

  const removed = await db
    .delete(marketingConsent)
    .where(eq(marketingConsent.phone, phone))
    .returning({ id: marketingConsent.id });

  // No PII in the log line — that would defeat the erasure.
  logger.info(
    { ordersAnonymised: result.length, consentRecordsRemoved: removed.length, reason },
    'personal data erased on request',
  );

  return { ordersAnonymised: result.length, consentRecordsRemoved: removed.length };
}

/** What we hold about a phone number, for a subject access request. */
export async function exportPersonalData(phone: string) {
  const db = getDb();
  const rows = await db.select().from(orders).where(eq(orders.phone, phone));
  const consents = await db.select().from(marketingConsent).where(eq(marketingConsent.phone, phone));
  const counted = await db.execute(sql`select count(*)::int as n from ${orders} where phone = ${phone}`);
  void counted;
  return { orders: rows, marketingConsent: consents };
}
