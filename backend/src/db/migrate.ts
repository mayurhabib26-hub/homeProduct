/**
 * Applies pending migrations. Forward-only — see docs/DATABASE.md §5.
 */
import 'dotenv/config';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { getDb } from './client.ts';

const db = getDb();
const isPglite = !process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('pglite:');
const run = isPglite ? (migratePglite as typeof migratePg) : migratePg;

await run(db as never, { migrationsFolder: './drizzle' });
console.log(`migrations applied (${isPglite ? 'pglite' : 'postgres'})`);
process.exit(0);
