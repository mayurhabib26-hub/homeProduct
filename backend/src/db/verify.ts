/** Ad-hoc seed verification. Run: npm run db:verify -w backend */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb } from './client.js';

const db = getDb();
const q = async (label: string, stmt: string) => {
  const r = (await db.execute(sql.raw(stmt))) as unknown as { rows?: unknown[] };
  console.log(label, JSON.stringify(r.rows ?? r));
};

await q('counts        ', `select
  (select count(*) from products)::int products,
  (select count(*) from variants)::int variants,
  (select count(*) from recipes)::int  recipes,
  (select count(*) from reviews)::int  reviews`);
await q('rasam variants', `select v.weight, v.price_paise, v.mrp_paise, v.stock_qty
  from variants v join products p on p.id=v.product_id
  where p.slug='rasam-powder' order by v.price_paise`);
await q('negative stock', `select count(*)::int violations from variants where stock_qty < 0`);
process.exit(0);
