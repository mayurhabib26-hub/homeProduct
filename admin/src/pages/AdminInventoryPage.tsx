import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { adminApi, type InventoryRow } from '../api/client';
import { PageHeader, Card, FilterTabs, SearchField } from '../components/ui/Layout';
import { StockBadge } from '../components/ui/StatusBadge';
import { SkeletonTable, SkeletonCards, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/cn';

const LOW_STOCK = 10;

/**
 * Inline stock editing with visible save state.
 *
 * A silent optimistic update is worse than none here: if the write fails the
 * operator must see the number go back, or they will restock against a figure
 * the server never accepted.
 */
const StockInput: React.FC<{ row: InventoryRow }> = ({ row }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(row.stockQty));
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<number>(0);

  const save = useMutation({
    mutationFn: (stockQty: number) => adminApi.updateVariant(row.variantId, { stockQty }),
    onMutate: () => setState('saving'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      setState('saved');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), 1800);
    },
    onError: () => {
      setValue(String(row.stockQty));
      setState('error');
    },
  });

  const commit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) { setValue(String(row.stockQty)); return; }
    if (n !== row.stockQty) save.mutate(n);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <label className="sr-only" htmlFor={`stock-${row.variantId}`}>
        Stock for {row.productName} {row.weight}
      </label>
      <input
        id={`stock-${row.variantId}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => { setValue(e.target.value); setState('idle'); }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={cn(
          'tabular w-20 min-h-11 rounded-md border bg-white px-2 text-right text-sm',
          state === 'error' ? 'border-[#A33A28]' : 'border-[#EBD9BC]',
        )}
      />
      <span aria-live="polite" className="text-[11px] w-14">
        {state === 'saving' && <span className="text-[#483828]/55">Saving…</span>}
        {state === 'saved' && <span className="text-[#647044] font-semibold">Saved</span>}
        {state === 'error' && <span className="text-[#A33A28] font-semibold">Restored</span>}
      </span>
    </span>
  );
};

export const AdminInventoryPage: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'inventory'],
    queryFn: adminApi.inventory,
  });

  const all = data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (filter === 'in' && r.stockQty <= LOW_STOCK) return false;
      if (filter === 'low' && !(r.stockQty > 0 && r.stockQty <= LOW_STOCK)) return false;
      if (filter === 'out' && r.stockQty !== 0) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        r.weight.toLowerCase().includes(q)
      );
    });
  }, [all, filter, search]);

  const counts = {
    '': all.length,
    in: all.filter((r) => r.stockQty > LOW_STOCK).length,
    low: all.filter((r) => r.stockQty > 0 && r.stockQty <= LOW_STOCK).length,
    out: all.filter((r) => r.stockQty === 0).length,
  };

  return (
    <>
      <PageHeader title="Inventory" subtitle="Track stock levels and avoid stockouts." />

      <div className="flex flex-col gap-3 mb-4">
        <SearchField
          value={search} onChange={setSearch} id="inventory-search"
          placeholder="Search by product, SKU or pack size…"
        />
        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: '', label: 'All', count: counts[''] },
            { value: 'in', label: 'In Stock', count: counts.in },
            { value: 'low', label: 'Low Stock', count: counts.low },
            { value: 'out', label: 'Out of Stock', count: counts.out },
          ]}
        />
      </div>

      {isLoading ? (
        <>
          <Card className="hidden lg:block"><SkeletonTable cols={5} /></Card>
          <div className="lg:hidden"><SkeletonCards /></div>
        </>
      ) : isError ? (
        <Card><ErrorState title="Couldn't load inventory" onRetry={() => refetch()} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            title={filter === 'out' ? 'Nothing is out of stock' : filter === 'low' ? 'Nothing is running low' : 'No products found'}
            hint="Try a different filter or search term."
            actions={<Button variant="secondary" onClick={() => { setFilter(''); setSearch(''); }}>Clear filters</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="hidden lg:block overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Inventory</caption>
              <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/55">
                <tr>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Product</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Pack</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">SKU</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Price</th>
                  <th scope="col" className="text-left px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="text-right px-4 py-2.5 font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBD9BC]">
                {rows.map((r) => (
                  <tr key={r.variantId} className={cn('hover:bg-[#F3E7D0]/40', r.stockQty === 0 && 'bg-[#A33A28]/4')}>
                    <td className="px-4 py-2">{r.productName}</td>
                    <td className="px-4 py-2 text-[#483828]/70">{r.weight}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-[#483828]/50">{r.sku}</td>
                    <td className="px-4 py-2 text-right tabular">{formatPaise(r.pricePaise)}</td>
                    <td className="px-4 py-2"><StockBadge qty={r.stockQty} threshold={LOW_STOCK} /></td>
                    <td className="px-4 py-2 text-right"><StockInput row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="lg:hidden space-y-2.5">
            {rows.map((r) => (
              <li
                key={r.variantId}
                className={cn(
                  'rounded-lg border border-[#EBD9BC] bg-white p-3.5',
                  r.stockQty === 0 && 'border-[#A33A28]/30 bg-[#A33A28]/4',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.productName}</p>
                    <p className="text-xs text-[#483828]/60">
                      {r.weight} · <span className="font-mono">{r.sku}</span>
                    </p>
                  </div>
                  <StockBadge qty={r.stockQty} threshold={LOW_STOCK} />
                </div>
                <div className="flex items-center justify-between gap-3 mt-3">
                  <span className="tabular text-xs text-[#483828]/60">{formatPaise(r.pricePaise)}</span>
                  <StockInput row={r} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
};
