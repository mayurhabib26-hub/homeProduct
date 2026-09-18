/**
 * Proves the database refuses what the application must never do.
 *
 * These constraints are the last line of defence against overselling: even if
 * the stock-decrement logic is wrong, Postgres says no. Run against a seeded
 * database: npm run db:test -w backend
 */
import { sql } from 'drizzle-orm';
import { getDb } from './client.ts';
const db = getDb();
try {
  await db.execute(sql`update variants set stock_qty = -1 where id = 1`);
  console.log('FAIL — database accepted negative stock');
  process.exit(1);
} catch (e) {
  console.log('OK   — database rejected negative stock:', (e as Error).message.split('\n')[0]);
}
try {
  await db.execute(sql`update variants set price_paise = 0 where id = 1`);
  console.log('FAIL — database accepted a zero price');
  process.exit(1);
} catch (e) {
  console.log('OK   — database rejected a zero price:', (e as Error).message.split('\n')[0]);
}
process.exit(0);
