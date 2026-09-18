/**
 * Queue worker. Runs as its own Railway service, separate from the API.
 *
 * A backlog of 5,000 confirmation messages must not compete for CPU with
 * checkout. See docs/ARCHITECTURE.md §3.4.
 *
 *   npm run worker -w backend
 */
import { claimJob, completeJob, failJob, queueDepth, type QueueName } from '../lib/queue.js';
import { runJob } from './handlers.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

const QUEUES: QueueName[] = ['notifications', 'fulfilment', 'documents'];
const IDLE_MS = 2_000;

let running = true;

async function workOnce(): Promise<boolean> {
  const job = await claimJob(QUEUES);
  if (!job) return false;

  try {
    await runJob(job.queue, job.payload);
    await completeJob(job.id);
    logger.info({ jobId: job.id, queue: job.queue, type: job.payload.type }, 'job done');
  } catch (err) {
    await failJob(job, err);
  }
  return true;
}

async function loop(id: number) {
  while (running) {
    try {
      const worked = await workOnce();
      if (!worked) await new Promise((r) => setTimeout(r, IDLE_MS));
    } catch (err) {
      // A failure in the loop itself — not in a handler. Back off rather than
      // spinning against a database that is down.
      logger.error({ err, worker: id }, 'worker loop error');
      await new Promise((r) => setTimeout(r, IDLE_MS * 5));
    }
  }
}

export async function startWorker() {
  logger.info({ concurrency: env.WORKER_CONCURRENCY, queues: QUEUES }, 'worker started');
  logger.info(await queueDepth(), 'queue depth at start');

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'worker draining');
    running = false;
    // Let in-flight handlers finish; BullMQ behaves the same way.
    setTimeout(() => process.exit(0), 15_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await Promise.all(
    Array.from({ length: env.WORKER_CONCURRENCY }, (_, i) => loop(i + 1)),
  );
}
