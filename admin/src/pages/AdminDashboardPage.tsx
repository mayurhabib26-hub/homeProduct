import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { adminApi } from '../api/client';

/**
 * Answers "what needs my attention right now", not "how is the quarter
 * going". The work queue comes first. See docs/ADMIN.md §4.2.
 */
const Tile: React.FC<{ label: string; value: string; tone?: 'normal' | 'warn' }> = ({
  label, value, tone = 'normal',
}) => (
  <div className="bg-white border border-[#EBD9BC] rounded-lg p-4">
    <div className="text-[11px] uppercase tracking-wider text-[#483828]/60">{label}</div>
    <div
      className={`text-2xl font-semibold mt-1 tabular-nums ${
        tone === 'warn' ? 'text-[#87380F]' : 'text-[#483828]'
      }`}
    >
      {value}
    </div>
  </div>
);

export const AdminDashboardPage: React.FC = () => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 60_000,
  });

  if (isLoading) return <p className="text-sm text-[#483828]/60" role="status">Loading…</p>;
  if (isError) {
    return (
      <div role="alert" className="text-sm">
        Could not load the dashboard.{' '}
        <button onClick={() => refetch()} className="underline font-semibold">Retry</button>
      </div>
    );
  }

  const s = data!;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Revenue today" value={formatPaise(Number(s.revenue_today))} />
        <Tile label="Orders today" value={String(s.orders_today)} />
        <Tile label="Awaiting packing" value={String(s.awaiting_packing)} tone={s.awaiting_packing > 0 ? 'warn' : 'normal'} />
        <Tile label="Low stock" value={String(s.low_stock)} tone={s.low_stock > 0 ? 'warn' : 'normal'} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Tile label="Revenue, 7 days" value={formatPaise(Number(s.revenue_week))} />
        <Tile label="Failed payments, 24h" value={String(s.failed_payments)} tone={s.failed_payments > 0 ? 'warn' : 'normal'} />
      </div>

      {s.jobs_failed > 0 && (
        <section className="bg-white border border-[#87380F]/30 rounded-lg">
          <h2 className="px-4 py-3 border-b border-[#87380F]/20 text-sm font-semibold text-[#87380F]">
            {s.jobs_failed} background {s.jobs_failed === 1 ? 'job' : 'jobs'} gave up
          </h2>
          <p className="px-4 pt-3 text-xs text-[#483828]/70">
            These customers did not get their message. Fix the cause, then re-queue.
          </p>
          <ul className="divide-y divide-[#EBD9BC] mt-2">
            {s.failedJobs.map((j, i) => (
              <li key={i} className="px-4 py-2.5 text-xs">
                <span className="font-semibold">{String(j.payload.type ?? j.queue)}</span>
                {j.payload.orderNumber ? (
                  <span className="font-mono text-[#87380F]"> {String(j.payload.orderNumber)}</span>
                ) : null}
                {j.lastError && <span className="block text-[#483828]/60 mt-0.5">{j.lastError}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white border border-[#EBD9BC] rounded-lg">
        <h2 className="px-4 py-3 border-b border-[#EBD9BC] text-sm font-semibold">
          Paid but unshipped for over 48 hours
        </h2>
        {s.stuckOrders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">Nothing waiting. </p>
        ) : (
          <ul className="divide-y divide-[#EBD9BC]">
            {s.stuckOrders.map((o) => (
              <li key={o.orderNumber} className="px-4 py-2.5 flex justify-between text-sm">
                <Link to={`/orders/${o.orderNumber}`} className="font-mono text-[#87380F] hover:underline">
                  {o.orderNumber}
                </Link>
                <span className="text-[#483828]/60 tabular-nums px-4">
                  {new Date(o.createdAt).toLocaleDateString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
