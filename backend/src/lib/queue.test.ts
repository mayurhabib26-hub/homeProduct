/**
 * Queue semantics. Run: npm run test:queue -w backend  (stop the API first)
 *
 * The properties that matter are the ones that go wrong quietly: a job run
 * twice, a job lost, a dedupe key that does not dedupe, a retry that never
 * backs off.
 */
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { jobs } from '../db/schema.js';
import { enqueue, claimJob, completeJob, failJob, queueDepth } from './queue.js';

const db = getDb();
await db.execute(sql`delete from ${jobs}`);

/* --- enqueue and claim -------------------------------------------------- */
await enqueue('notifications', { type: 'order.confirmation', orderNumber: 'SV-TEST-00001' });
const job = await claimJob(['notifications']);
assert.ok(job, 'a pending job is claimable');
assert.equal(job!.payload.orderNumber, 'SV-TEST-00001');
assert.equal(job!.attempts, 1, 'claiming counts as an attempt');

/* --- a claimed job is not handed to a second worker --------------------- */
assert.equal(await claimJob(['notifications']), null, 'a running job is not re-claimed');

await completeJob(job!.id);
assert.equal(await claimJob(['notifications']), null, 'a completed job is not re-claimed');

/* --- dedupe ------------------------------------------------------------- */
const first = await enqueue('notifications', { type: 'x' }, { dedupeKey: 'confirmation:SV-TEST-00002' });
const second = await enqueue('notifications', { type: 'x' }, { dedupeKey: 'confirmation:SV-TEST-00002' });
assert.equal(first, true, 'first enqueue succeeds');
assert.equal(second, false, 'a duplicate dedupe key is refused, not duplicated');

const depth = await queueDepth();
assert.equal(depth.pending, 1, 'exactly one job exists for that dedupe key');

/* --- retries back off, and are not immediately re-claimable ------------- */
const retryable = await claimJob(['notifications']);
await failJob(retryable!, new Error('provider unavailable'));
assert.equal(
  await claimJob(['notifications']),
  null,
  'a failed job backs off — it is not re-claimable straight away',
);

/* --- the attempt budget is finite -------------------------------------- */
await db.execute(sql`delete from ${jobs}`);
await enqueue('notifications', { type: 'doomed' }, { maxAttempts: 2 });

for (let i = 0; i < 2; i++) {
  await db.execute(sql`update ${jobs} set run_after = now() - interval '1 hour'`);
  const attempt = await claimJob(['notifications']);
  assert.ok(attempt, `attempt ${i + 1} claimable`);
  await failJob(attempt!, new Error('still broken'));
}

await db.execute(sql`update ${jobs} set run_after = now() - interval '1 hour'`);
assert.equal(await claimJob(['notifications']), null, 'an exhausted job stops retrying');

const finalDepth = await queueDepth();
assert.equal(finalDepth.failed, 1, 'it is recorded as failed, not silently dropped');

/* --- queues are isolated ------------------------------------------------ */
await db.execute(sql`delete from ${jobs}`);
await enqueue('fulfilment', { type: 'shipment.book' });
assert.equal(await claimJob(['notifications']), null, 'a worker does not steal another queue');
assert.ok(await claimJob(['fulfilment']), 'but claims its own');

await db.execute(sql`delete from ${jobs}`);
console.log('queue.ts: all assertions passed');
process.exit(0);
