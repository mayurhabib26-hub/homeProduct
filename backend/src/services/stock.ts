/**
 * The only code in this codebase that changes stock_qty.
 *
 * Every path — order, cancel, refund, RTO — goes through here. That is a hard
 * rule (CLAUDE.md), because a second place that decrements stock is a second
 * place that can oversell.
 */
import { sql } from 'drizzle-orm';
import { ApiError } from '../lib/errors.js';
import type { Database } from '../db/client.js';

export interface StockLine {
  variantId: number;
  quantity: number;
}

export class InsufficientStockError extends ApiError {
  constructor(readonly variantId: number) {
    super(409, 'INSUFFICIENT_STOCK', 'Some items in your cart just sold out.', { variantId });
  }
}

/**
 * Deterministic lock order.
 *
 * Two carts containing the same two variants in opposite order will deadlock
 * otherwise. This is a reproducible bug, not a theoretical one, and sorting by
 * id is the whole fix. See docs/ARCHITECTURE.md §4.2.
 */
const inLockOrder = (lines: StockLine[]) => [...lines].sort((a, b) => a.variantId - b.variantId);

/**
 * Decrement, guarded.
 *
 * `WHERE stock_qty >= quantity` in the UPDATE is what makes this safe under
 * concurrency: the row count tells you whether it worked. A SELECT followed by
 * an UPDATE — check-then-act — oversells the moment two orders overlap.
 *
 * Must be called inside a transaction, and the transaction must stay short:
 * no third-party calls, no application logic, no extra round trips. Throughput
 * on a hot variant is 1 / lock_hold_time.
 */
export async function decrementStock(tx: Database, lines: StockLine[]): Promise<void> {
  for (const line of inLockOrder(lines)) {
    const result = await tx.execute(sql`
      update variants
         set stock_qty = stock_qty - ${line.quantity}
       where id = ${line.variantId}
         and stock_qty >= ${line.quantity}
    `);

    const affected = rowCount(result);
    if (affected !== 1) throw new InsufficientStockError(line.variantId);
  }
}

/** Restore on cancel, failed payment, RTO or a restocking refund. */
export async function restoreStock(tx: Database, lines: StockLine[]): Promise<void> {
  for (const line of inLockOrder(lines)) {
    await tx.execute(sql`
      update variants
         set stock_qty = stock_qty + ${line.quantity}
       where id = ${line.variantId}
    `);
  }
}

/**
 * postgres.js and PGlite report affected rows differently; normalise here so
 * the guard above reads the same against either.
 */
function rowCount(result: unknown): number {
  const r = result as { rowCount?: number; count?: number; affectedRows?: number };
  return r.rowCount ?? r.count ?? r.affectedRows ?? 0;
}
