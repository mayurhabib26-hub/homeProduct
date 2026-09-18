import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { formatPaise, rupees } from '@sv/shared';
import { adminApi, type AdminIdentity } from '../api/client';

/** Owner-only. Discounts move money. */
export const AdminCouponsPage: React.FC = () => {
  const me = useOutletContext<AdminIdentity | undefined>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', type: 'percent', value: '10', minOrder: '0', maxDiscount: '' });

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: adminApi.coupons });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createCoupon({
        code: form.code.trim().toUpperCase(),
        type: form.type,
        // A percent coupon's value is percentage points; a flat one is paise.
        value: form.type === 'percent' ? Number(form.value) : rupees(Number(form.value)),
        minOrderPaise: rupees(Number(form.minOrder || 0)),
        maxDiscountPaise: form.maxDiscount ? rupees(Number(form.maxDiscount)) : null,
      }),
    onSuccess: () => { setForm({ ...form, code: '' }); invalidate(); },
    onError: (e: Error) => setError(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) => adminApi.setCouponActive(code, active),
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  if (me?.role !== 'owner') {
    return <p className="text-sm text-[#483828]/70">Coupons are managed by the owner account.</p>;
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate(); }}
        className="bg-white border border-[#EBD9BC] rounded-lg p-4 flex flex-wrap items-end gap-3"
      >
        <label className="text-xs">
          <span className="block mb-1 text-[#483828]/70">Code</span>
          <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="border border-[#EBD9BC] rounded px-2 min-h-11 text-sm font-mono uppercase bg-[#FAF6F0] w-36" />
        </label>
        <label className="text-xs">
          <span className="block mb-1 text-[#483828]/70">Type</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="border border-[#EBD9BC] rounded px-2 min-h-11 text-sm bg-[#FAF6F0]">
            <option value="percent">Percent</option>
            <option value="flat">Flat ₹</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block mb-1 text-[#483828]/70">{form.type === 'percent' ? 'Percent' : 'Amount ₹'}</span>
          <input required inputMode="numeric" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
            className="border border-[#EBD9BC] rounded px-2 min-h-11 text-sm tabular-nums bg-[#FAF6F0] w-24" />
        </label>
        <label className="text-xs">
          <span className="block mb-1 text-[#483828]/70">Min order ₹</span>
          <input inputMode="numeric" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            className="border border-[#EBD9BC] rounded px-2 min-h-11 text-sm tabular-nums bg-[#FAF6F0] w-24" />
        </label>
        {form.type === 'percent' && (
          <label className="text-xs">
            <span className="block mb-1 text-[#483828]/70">Cap ₹</span>
            <input inputMode="numeric" placeholder="none" value={form.maxDiscount}
              onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
              className="border border-[#EBD9BC] rounded px-2 min-h-11 text-sm tabular-nums bg-[#FAF6F0] w-24" />
          </label>
        )}
        <button type="submit" disabled={create.isPending}
          className="inline-flex items-center min-h-11 px-4 bg-[#87380F] hover:bg-[#6d2d0c] disabled:opacity-50 text-white rounded text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#87380F]/40">
          {create.isPending ? 'Creating…' : 'Create'}
        </button>
      </form>

      {error && (
        <p role="alert" className="text-xs text-[#87380F] bg-[#87380F]/8 border border-[#87380F]/25 rounded p-2.5">
          {error}
        </p>
      )}

      <div className="bg-white border border-[#EBD9BC] rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60" role="status">Loading coupons…</p>
        ) : data?.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">No coupons yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/60">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Code</th>
                <th className="text-left px-4 py-2.5 font-semibold">Discount</th>
                <th className="text-right px-4 py-2.5 font-semibold">Min order</th>
                <th className="text-right px-4 py-2.5 font-semibold">Used</th>
                <th className="text-right px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD9BC]">
              {data?.map((c) => (
                <tr key={c.code} className={c.active ? undefined : 'opacity-50'}>
                  <td className="px-4 py-2.5 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-2.5">
                    {c.type === 'percent' ? `${c.value}%` : formatPaise(c.value)}
                    {c.maxDiscountPaise && (
                      <span className="text-[#483828]/50"> · max {formatPaise(c.maxDiscountPaise)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.minOrderPaise > 0 ? formatPaise(c.minOrderPaise) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => { setError(null); toggle.mutate({ code: c.code, active: !c.active }); }}
                      className="inline-flex items-center text-[11px] min-h-11 px-2.5 border border-[#EBD9BC] rounded hover:bg-[#F3E7D0]/50 font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#87380F]/40"
                    >
                      {c.active ? 'Disable' : 'Enable'}
                    </button>
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
