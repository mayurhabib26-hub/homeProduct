/**
 * Post-restore verification.
 *
 * Run this against a database restored from a backup, BEFORE pointing the API
 * at it. A restore that loads rows but leaves sequences behind looks perfect
 * until the next insert, which fails on a duplicate key — or worse, succeeds
 * and issues an invoice number that already exists.
 *
 *   DATABASE_URL=<restored> npm run db:verify-restore -w backend
 *
 * See docs/DEPLOYMENT.md §6.
 */
import { sql } from 'drizzle-orm';
import { getDb } from './client.js';

const db = getDb();
const rows = async (q: ReturnType<typeof sql>) => {
  const r = (await db.execute(q)) as unknown as { rows?: unknown[] } | unknown[];
  return (Array.isArray(r) ? r : (r.rows ?? [])) as Record<string, unknown>[];
};

/**
 * Returns the labels of every failed check. Empty means the restore is safe.
 * Exported so the drill in scripts/restore-drill.ts can assert that these
 * checks actually fail on a damaged database — a verifier nobody has seen
 * fail is a verifier nobody should trust.
 */
export async function verifyRestore(quiet = false): Promise<string[]> {
const failures: string[] = [];
const log = (s = '') => { if (!quiet) console.log(s); };
const check = (ok: boolean, label: string, detail = '') => {
  log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

log('post-restore verification\n');

/**
 * 1. Every identity/serial sequence must be at or past the largest id it owns.
 *
 * This is the failure a restore drill exists to catch: pg_restore loads rows
 * with explicit ids and does not advance the sequence unless the dump says
 * so. Nothing looks wrong until the next INSERT.
 */
const seqs = await rows(sql`
  select
    c.relname            as table_name,
    a.attname            as column_name,
    pg_get_serial_sequence(c.relname, a.attname) as seq
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
    and pg_get_serial_sequence(c.relname, a.attname) is not null
  order by c.relname
`);

for (const s of seqs) {
  const table = String(s.table_name), col = String(s.column_name), seq = String(s.seq);
  const [r] = await rows(sql`
    select
      coalesce((select max(${sql.identifier(col)}) from ${sql.identifier(table)}), 0) as max_id,
      (select last_value from ${sql.raw(seq)})                                       as last_value,
      (select is_called from ${sql.raw(seq)})                                        as is_called
  `);
  const maxId = Number(r!.max_id);
  const lastValue = Number(r!.last_value);
  const isCalled = r!.is_called === true;
  // An untouched sequence reports last_value 1 with is_called false, which is
  // correct for an empty table and catastrophic for a restored one.
  const next = isCalled ? lastValue + 1 : lastValue;
  check(next > maxId, `sequence ahead of data: ${table}.${col}`,
        `max=${maxId} next=${next}`);
}

/** 2. order_number_seq — duplicate order numbers are customer-visible. */
const [onr] = await rows(sql`
  select
    (select last_value from order_number_seq) as last_value,
    (select is_called  from order_number_seq) as is_called,
    (select count(*)   from orders)           as order_count
`);
check(Number(onr!.order_count) === 0 || onr!.is_called === true,
      'order_number_seq has been advanced',
      `orders=${onr!.order_count} last=${onr!.last_value}`);

/** 3. Invoice numbering must stay gap-free and unique per financial year. */
const gaps = await rows(sql`
  select financial_year, count(*) as n, min(sequence) as lo, max(sequence) as hi
  from invoices group by financial_year
`);
for (const g of gaps) {
  const n = Number(g.n), lo = Number(g.lo), hi = Number(g.hi);
  check(lo === 1 && hi === n, `invoice sequence gap-free: ${g.financial_year}`,
        `count=${n} range=${lo}..${hi}`);
}
if (gaps.length === 0) check(true, 'invoice sequence gap-free', 'no invoices yet');

/**
 * 4. Every order still has its line items.
 *
 * order_items are the snapshots that let an invoice survive a product being
 * discontinued. A restore that lost them is a restore that lost the tax
 * record. This has gone wrong once already — see CLAUDE.md on TRUNCATE.
 */
const [orphan] = await rows(sql`
  select count(*) as n from orders o
  where not exists (select 1 from order_items i where i.order_id = o.id)
`);
check(Number(orphan!.n) === 0, 'every order has line items', `orphans=${orphan!.n}`);

/** 5. Order totals still reconcile against their items. */
const [drift] = await rows(sql`
  select count(*) as n from (
    select o.id, o.subtotal_paise,
           coalesce(sum(i.unit_price_paise * i.quantity), 0) as items_paise
    from orders o join order_items i on i.order_id = o.id
    group by o.id, o.subtotal_paise
  ) t where t.subtotal_paise <> t.items_paise
`);
check(Number(drift!.n) === 0, 'order subtotals reconcile with items', `drifted=${drift!.n}`);

log();
if (!failures.length) log(`restore verified — ${seqs.length} sequences, all checks passed`);
return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const failures = await verifyRestore();
  if (failures.length) {
    console.error(`RESTORE NOT SAFE — ${failures.length} check(s) failed:`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nDo not point the API at this database.');
    process.exit(1);
  }
  process.exit(0);
}
