import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IndianRupee, ShoppingCart, PackageCheck, Boxes, TrendingUp, AlertTriangle, RotateCw,
} from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminIdentity } from '../api/client';
import { PageHeader, Card, SectionTitle } from '../components/ui/Layout';
import { MetricCard } from '../components/ui/MetricCard';
import { SkeletonCards, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

/**
 * Answers "what needs my attention now", not "how was the quarter".
 * The work queues below the tiles are the point; the tiles are context.
 */
export const AdminDashboardPage: React.FC = () => {
  const me = useOutletContext<AdminIdentity | undefined>();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.stats,
    refetchInterval: 60_000,
  });

  const pack = useMutation({
    mutationFn: (orderNumber: string) => adminApi.setStatus(orderNumber, { status: 'packed' }),
    onSuccess: (_r, orderNumber) => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      notify({ tone: 'success', title: `Order ${orderNumber} marked as Packed.` });
    },
    onError: (e: Error) => notify({ tone: 'error', title: "Couldn't update order", detail: e.message }),
  });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="What needs your attention today." />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-white border border-[#EBD9BC] rounded-lg p-4 space-y-3">
              <div className="skeleton w-9 h-9 rounded-full" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-6 w-24" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card><ErrorState title="Couldn't load data" onRetry={() => refetch()} /></Card>
      </>
    );
  }

  const s = data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="What needs your attention today." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          label="Revenue today" value={formatPaise(Number(s.revenue_today))}
          icon={<IndianRupee size={17} />}
        />
        <MetricCard
          label="Orders today" value={String(s.orders_today)}
          icon={<ShoppingCart size={17} />}
        />
        <MetricCard
          label="Awaiting packing" value={String(s.awaiting_packing)}
          icon={<PackageCheck size={17} />}
          alert={s.awaiting_packing > 0 ? 'Needs action' : undefined}
          to="/orders?status=confirmed"
        />
        <MetricCard
          label="Low stock" value={String(s.low_stock)}
          icon={<Boxes size={17} />}
          alert={s.low_stock > 0 ? 'Reorder soon' : undefined}
          to="/inventory"
        />
        <MetricCard
          label="Revenue, 7 days" value={formatPaise(Number(s.revenue_week))}
          icon={<TrendingUp size={17} />}
        />
        <MetricCard
          label="Failed payments, 24h" value={String(s.failed_payments)}
          icon={<AlertTriangle size={17} />}
          alert={s.failed_payments > 0 ? 'Needs attention' : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Card>
          <SectionTitle count={s.stuckOrders.length}>Paid but unshipped, over 48 hours</SectionTitle>
          {s.stuckOrders.length === 0 ? (
            <EmptyState title="All caught up" hint="Nothing has been waiting more than 48 hours." />
          ) : (
            <ul className="divide-y divide-[#EBD9BC]">
              {s.stuckOrders.map((o) => {
                const hours = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 3_600_000);
                return (
                  <li key={o.orderNumber} className="flex items-center gap-2 px-4 py-2">
                    <Link
                      to={`/orders/${o.orderNumber}`}
                      className="flex-1 min-w-0 min-h-11 flex items-center font-mono text-sm text-[#87380F] hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                    <span className="tabular text-xs text-[#A33A28] font-semibold shrink-0">{hours}h</span>
                    <Button
                      compact
                      disabled={pack.isPending}
                      onClick={() => pack.mutate(o.orderNumber)}
                      className="shrink-0"
                    >
                      Pack
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle count={s.jobs_failed}>Background jobs that gave up</SectionTitle>
          {s.failedJobs.length === 0 ? (
            <EmptyState title="Nothing failed" hint="Every queued message and document went out." />
          ) : (
            <>
              <p className="px-4 pt-3 text-xs text-[#483828]/65">
                These customers did not get their message. Fix the cause, then re-queue.
              </p>
              <ul className="divide-y divide-[#EBD9BC] mt-2">
                {s.failedJobs.map((j, i) => (
                  <li key={i} className="px-4 py-2.5 flex items-start gap-3">
                    <span className="flex-1 min-w-0 text-xs">
                      <span className="font-semibold">{String(j.payload.type ?? j.queue)}</span>
                      {j.payload.orderNumber ? (
                        <span className="font-mono text-[#87380F]"> {String(j.payload.orderNumber)}</span>
                      ) : null}
                      {j.lastError && (
                        <span className="block text-[#483828]/60 mt-0.5 truncate">{j.lastError}</span>
                      )}
                    </span>
                    <RotateCw size={14} aria-hidden="true" className="mt-1 shrink-0 text-[#483828]/30" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {me?.role !== 'owner' && (
        <p className="mt-5 text-[11px] text-[#483828]/50">
          Signed in as staff. Refunds, pricing and coupons are owner-only.
        </p>
      )}
    </>
  );
};
