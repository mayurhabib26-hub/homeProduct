import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminOrderRow } from '../api/client';
import { PageHeader, Card, FilterTabs, SearchField } from '../components/ui/Layout';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SkeletonTable, SkeletonCards, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
];

export const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Default to the work queue, not the archive.
  const status = params.get('status') ?? 'confirmed';
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () => adminApi.orders(status ? { status } : {}),
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q),
    );
  }, [data, search]);

  useEffect(() => setCursor(0), [status, search]);

  /**
   * Keyboard navigation. Order processing is repetitive; reaching for the
   * mouse forty times is the slow path. See docs/ADMIN.md §2.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = document.activeElement?.tagName === 'INPUT';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === 'Escape' && typing) {
        searchRef.current?.blur();
        return;
      }
      if (typing || rows.length === 0) return;

      if (e.key === 'j') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
      if (e.key === 'k') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === 'Enter') { e.preventDefault(); navigate(`/orders/${rows[cursor]!.orderNumber}`); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, cursor, navigate]);

  const header = (
    <PageHeader
      title="Orders"
      subtitle="Process orders and keep customers moving."
      shortcuts
    />
  );

  const counts = (value: string) =>
    value === status ? rows.length : undefined;

  return (
    <>
      {header}

      <div className="flex flex-col gap-3 mb-4">
        <SearchField
          inputRef={searchRef}
          value={search}
          onChange={setSearch}
          placeholder="Search by order no, customer name or city…"
          id="order-search"
        />
        <FilterTabs
          options={FILTERS.map((f) => ({ ...f, count: counts(f.value) }))}
          value={status}
          onChange={(v) => setParams(v ? { status: v } : {})}
        />
      </div>

      {isLoading ? (
        <>
          <Card className="hidden lg:block"><SkeletonTable /></Card>
          <div className="lg:hidden"><SkeletonCards /></div>
        </>
      ) : isError ? (
        <Card>
          <ErrorState
            title="Couldn't load orders"
            hint="We're having trouble fetching orders. Please try again."
            onRetry={() => refetch()}
            actions={<Link to="/"><Button variant="secondary">Go to dashboard</Button></Link>}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No orders match your filters"
            hint="Try clearing the filter or searching with a different keyword."
            actions={
              <>
                <Button variant="secondary" onClick={() => { setParams({}); setSearch(''); }}>
                  Clear filters
                </Button>
                <Button onClick={() => searchRef.current?.focus()}>Search orders</Button>
              </>
            }
          />
        </Card>
      ) : (
        <>
          {/* Desktop: dense table */}
          <Card className="hidden lg:block overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Orders</caption>
              <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/55">
                <tr>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Order No.</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">City</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Payment</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Total</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBD9BC]">
                {rows.map((o, i) => (
                  <tr
                    key={o.orderNumber}
                    className={cn(
                      'hover:bg-[#F3E7D0]/50 transition-colors',
                      i === cursor && 'bg-[#F3E7D0]/70',
                    )}
                  >
                    <td className="p-0">
                      <Link
                        to={`/orders/${o.orderNumber}`}
                        className="flex items-center min-h-11 px-4 font-mono text-[#87380F] hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{o.customerName}</td>
                    <td className="px-4 py-2 text-[#483828]/70">{o.city}</td>
                    <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-2">
                      <span className="text-xs uppercase text-[#483828]/70">{o.paymentMethod}</span>{' '}
                      <StatusBadge status={o.paymentStatus} kind="payment" />
                    </td>
                    <td className="px-4 py-2 text-right tabular font-semibold">{formatPaise(o.totalPaise)}</td>
                    <td className="px-4 py-2 text-right tabular text-xs text-[#483828]/60">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: the whole card is the target */}
          <ul className="lg:hidden space-y-2.5">
            {rows.map((o) => (
              <li key={o.orderNumber}>
                <Link
                  to={`/orders/${o.orderNumber}`}
                  className="flex items-center gap-3 rounded-lg border border-[#EBD9BC] bg-white p-3.5 active:bg-[#F3E7D0]/50"
                >
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm text-[#87380F]">{o.orderNumber}</span>
                      <span className="tabular text-[11px] text-[#483828]/55">
                        {new Date(o.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </span>
                    <span className="block text-sm font-semibold mt-1">{o.customerName}</span>
                    <span className="block text-xs text-[#483828]/60">{o.city}</span>
                    <span className="flex items-center gap-1.5 mt-2">
                      <StatusBadge status={o.status} />
                      <StatusBadge status={o.paymentStatus} kind="payment" />
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-2 shrink-0">
                    <span className="tabular text-sm font-bold">{formatPaise(o.totalPaise)}</span>
                    <ChevronRight size={16} aria-hidden="true" className="text-[#483828]/30" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};
