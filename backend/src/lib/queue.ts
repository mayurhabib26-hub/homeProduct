/**
 * Durable job queue.
 *
 * Producers call enqueue() inside or after a transaction; the worker claims
 * jobs with FOR UPDATE SKIP LOCKED, so several workers can run without ever
 * handing the same job to two of them.
 *
 * At-least-once, not exactly-once. A handler may run twice — after a crash
 * between doing the work and marking it done — so handlers must be
 * idempotent. That is true of BullMQ too; it is a property of queues, not of
 * this implementation.
 */
import { sql } from 'drizzle-orm';
import { getDb, type Database } from '../db/client.js';
import { jobs } from '../db/schema.js';
import { logger } from './logger.js';

export type QueueName = 'notifications' | 'fulfilment' | 'documents';

export interface EnqueueOptions {
  /** Jobs that must not be enqueued twice: "confirmation:SV-2609-01000". */
  dedupeKey?: string;
  maxAttempts?: number;
  delayMs?: number;
}

export async function enqueue(
  queue: QueueName,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
  tx?: Database,
): Promise<boolean> {
  const db = tx ?? getDb();
  try {
    await db.insert(jobs).values({
      queue,
      payload,
      dedupeKey: options.dedupeKey ?? null,
      maxAttempts: options.maxAttempts ?? 5,
      runAfter: new Date(Date.now() + (options.delayMs ?? 0)),
    });
    return true;
  } catch {
    // A duplicate dedupeKey means the job already exists. That is success.
    logger.debug({ queue, dedupeKey: options.dedupeKey }, 'job already queued');
    return false;
  }
}

export interface Job {
  id: number;
  queue: QueueName;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/**
 * Exponential backoff with a ceiling: 1m, 2m, 4m, 8m, capped at an hour.
 *
 * A third party that is down stays down for minutes, not milliseconds —
 * retrying faster just burns the attempt budget before it recovers.
 */
const backoffMs = (attempt: number) => Math.min(60_000 * 2 ** (attempt - 1), 3_600_000);

/**
 * Claim one job. SKIP LOCKED is what makes this safe with several workers:
 * a row already locked by another worker is passed over rather than waited on.
 */
export async function claimJob(queues: QueueName[]): Promise<Job | null> {
  const db = getDb();
  const list = sql.join(queues.map((q) => sql`${q}`), sql`, `);

  const result = await db.execute(sql`
    update jobs set status = 'running', attempts = attempts + 1
     where id = (
       select id from jobs
        where status = 'pending'
          and queue in (${list})
          and run_after <= now()
        order by run_after
        for update skip locked
        limit 1
     )
    returning id, queue, payload, attempts, max_attempts
  `);

  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    id: number; queue: QueueName; payload: Record<string, unknown>;
    attempts: number; max_attempts: number;
  }>;

  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id), queue: row.queue, payload: row.payload,
    attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts),
  };
}

export async function completeJob(id: number): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    update jobs set status = 'done', completed_at = now(), last_error = null where id = ${id}`);
}

/** Reschedule with backoff, or give up once the attempt budget is spent. */
export async function failJob(job: Job, error: unknown): Promise<void> {
  const db = getDb();
  const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
  const exhausted = job.attempts >= job.maxAttempts;

  if (exhausted) {
    await db.execute(sql`
      update jobs set status = 'failed', last_error = ${message} where id = ${job.id}`);
    // Loud, because a job nobody notices failing is worse than one that
    // crashes: the order simply never gets its confirmation.
    logger.error({ jobId: job.id, queue: job.queue, attempts: job.attempts, error: message },
      'job failed permanently');
    return;
  }

  const delay = backoffMs(job.attempts);
  await db.execute(sql`
    update jobs
       set status = 'pending',
           run_after = now() + (${delay} || ' milliseconds')::interval,
           last_error = ${message}
     where id = ${job.id}`);
  logger.warn({ jobId: job.id, queue: job.queue, attempts: job.attempts, retryInMs: delay, error: message },
    'job failed, will retry');
}

export async function queueDepth(): Promise<Record<string, number>> {
  const db = getDb();
  const result = await db.execute(sql`
    select status, count(*)::int as n from jobs group by status`);
  const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{
    status: string; n: number;
  }>;
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
}
