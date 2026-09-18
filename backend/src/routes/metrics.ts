/**
 * Operational metrics.
 *
 * Deliberately small — the table in docs/OBSERVABILITY.md §3, not everything
 * that could be counted. A dashboard nobody reads is worse than none, because
 * it manufactures confidence.
 *
 * The one that matters most is orders_last_hour: every service can be healthy
 * — 200s, low latency, no errors — while a broken frontend build means nobody
 * can check out. An absence-of-success signal is the only thing that notices.
 */
import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { asyncRoute } from '../middleware/error-handler.js';
import { requireAdmin, requireRole } from '../middleware/admin-auth.js';
import { getDb } from '../db/client.js';

export const metricsRouter = Router();

metricsRouter.get(
  '/admin/metrics',
  requireAdmin,
  requireRole('owner'),
  asyncRoute(async (_req, res) => {
    const db = getDb();

    const result = await db.execute(sql`
      select
        (select count(*)::int from orders
          where created_at > now() - interval '1 hour') as orders_last_hour,
        (select count(*)::int from orders
          where created_at > now() - interval '24 hours') as orders_last_day,
        (select count(*)::int from orders
          where payment_status = 'failed'
            and created_at > now() - interval '1 hour') as payment_failures_last_hour,
        (select count(*)::int from orders
          where status = 'pending'
            and created_at < now() - interval '30 minutes') as stale_pending_orders,
        (select count(*)::int from jobs where status = 'pending') as jobs_pending,
        (select count(*)::int from jobs where status = 'failed') as jobs_failed,
        (select count(*)::int from jobs
          where status = 'pending' and run_after < now() - interval '15 minutes') as jobs_overdue,
        (select count(*)::int from variants where stock_qty = 0 and active) as variants_out_of_stock,
        (select count(*)::int from webhook_events
          where processed_at is null
            and received_at < now() - interval '5 minutes') as webhooks_unprocessed
    `);

    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as
      Record<string, number>[];
    const metrics = rows[0] ?? {};

    /**
     * Conditions worth waking someone for. Computed here rather than left to
     * whoever reads the numbers — a threshold in someone's head is not an
     * alert. See docs/OBSERVABILITY.md §4.
     */
    const alerts: string[] = [];
    if (Number(metrics.jobs_failed) > 0) {
      alerts.push(`${metrics.jobs_failed} background job(s) gave up — a customer did not get their message`);
    }
    if (Number(metrics.jobs_overdue) > 0) {
      alerts.push(`${metrics.jobs_overdue} job(s) overdue by 15 minutes — is the worker running?`);
    }
    if (Number(metrics.payment_failures_last_hour) > 5) {
      alerts.push(`${metrics.payment_failures_last_hour} payment failures in the last hour`);
    }
    if (Number(metrics.stale_pending_orders) > 0) {
      alerts.push(`${metrics.stale_pending_orders} order(s) holding stock without payment — is reconciliation running?`);
    }
    if (Number(metrics.webhooks_unprocessed) > 0) {
      alerts.push(`${metrics.webhooks_unprocessed} webhook(s) received but not processed`);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: { metrics, alerts, healthy: alerts.length === 0 } });
  }),
);
