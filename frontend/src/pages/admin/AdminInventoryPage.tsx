import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { adminApi, type InventoryRow } from '../../api/admin';

/**
 * A dedicated screen because stock is edited far more often than product
 * copy. Inline edit, save on blur, every change written to audit_log.
 * See docs/ADMIN.md §4.5.
 */
const LOW_STOCK = 5;

const StockCell: React.FC<{ row: InventoryRow }> = ({ row }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(row.stockQty));
  const [error, setError] = useState(false);

  const save = useMutation({
    mutationFn: (stockQty: number) => adminApi.updateVariant(row.variantId, { stockQty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
    onError: () => {
      // Optimistic edits must revert visibly, not silently keep a number the
      // server rejected.
      setValue(String(row.stockQty));
      setError(true);
    },
  });

  const commit = () => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setValue(String(row.stockQty));
      return;
    }
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
        onChange={(e) => { setValue(e.target.value); setError(false); }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={`w-20 text-right tabular-nums border rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#87380F]/40 ${
          error ? 'border-[#87380F]' : 'border-[#EBD9BC]'
        }`}
      />
      {save.isPending && <span className="text-[10px] text-[#483828]/50">saving…</span>}
      {error && <span className="text-[10px] text-[#87380F]" role="alert">not saved</span>}
    </span>
  );
};

export const AdminInventoryPage: React.FC = () => {
  const [onlyLow, setOnlyLow] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'inventory'], queryFn: adminApi.inventory });

  const rows = (data ?? []).filter((r) => !onlyLow || r.stockQty <= LOW_STOCK);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
        Show only low stock (≤ {LOW_STOCK})
      </label>

      <div className="bg-white border border-[#EBD9BC] rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60" role="status">Loading inventory…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">
            {onlyLow ? 'Nothing is running low.' : 'No variants.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/60">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                <th className="text-left px-4 py-2.5 font-semibold">Pack</th>
                <th className="text-left px-4 py-2.5 font-semibold">SKU</th>
                <th className="text-right px-4 py-2.5 font-semibold">Price</th>
                <th className="text-right px-4 py-2.5 font-semibold">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD9BC]">
              {rows.map((r) => (
                <tr key={r.variantId} className={r.stockQty === 0 ? 'bg-[#87380F]/5' : undefined}>
                  <td className="px-4 py-2">{r.productName}</td>
                  <td className="px-4 py-2 text-[#483828]/70">{r.weight}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-[#483828]/50">{r.sku}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatPaise(r.pricePaise)}</td>
                  <td className="px-4 py-2 text-right">
                    <StockCell row={r} />
                    {r.stockQty === 0 && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-[#87380F]">out</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
