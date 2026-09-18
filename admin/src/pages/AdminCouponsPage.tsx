import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { formatPaise, rupees } from '@sv/shared';
import { adminApi, type AdminIdentity } from '../api/client';
import { PageHeader, Card, SectionTitle } from '../components/ui/Layout';
import { SkeletonTable, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

const Field: React.FC<{
  label: string; id: string; value: string; onChange: (v: string) => void;
  hint?: string; type?: string; required?: boolean;
}> = ({ label, id, value, onChange, hint, type = 'text', required }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold mb-1">
      {label} {required && <span aria-hidden="true" className="text-[#A33A28]">*</span>}
    </label>
    <input
      id={id} type={type} value={value} required={required}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] px-3 text-sm"
    />
    {hint && <p id={`${id}-hint`} className="text-[11px] text-[#483828]/55 mt-1">{hint}</p>}
  </div>
);

export const AdminCouponsPage: React.FC = () => {
  const me = useOutletContext<AdminIdentity | undefined>();
  const isOwner = me?.role === 'owner';
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [form, setForm] = useState({ code: '', type: 'percent', value: '10', minOrder: '0', maxDiscount: '' });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: adminApi.coupons,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createCoupon({
        code: form.code.trim().toUpperCase(),
        type: form.type,
        // Percent coupons carry percentage points; flat ones carry paise.
        value: form.type === 'percent' ? Number(form.value) : rupees(Number(form.value)),
        minOrderPaise: rupees(Number(form.minOrder || 0)),
        maxDiscountPaise: form.maxDiscount ? rupees(Number(form.maxDiscount)) : null,
      }),
    onSuccess: () => {
      setForm({ ...form, code: '' });
      invalidate();
      notify({ tone: 'success', title: 'Coupon created and enabled.' });
    },
    onError: (e: Error) => notify({ tone: 'error', title: "Couldn't create coupon", detail: e.message }),
  });

  const toggle = useMutation({
    mutationFn: ({ code, active }: { code: string; active: boolean }) => adminApi.setCouponActive(code, active),
    onSuccess: invalidate,
    onError: (e: Error) => notify({ tone: 'error', title: "Couldn't update coupon", detail: e.message }),
  });

  return (
    <>
      <PageHeader title="Coupons" subtitle="Create and manage discount codes." />

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="overflow-hidden order-2 lg:order-1">
          <SectionTitle count={data?.length}>All coupons</SectionTitle>
          {isLoading ? (
            <SkeletonTable cols={5} rows={5} />
          ) : isError ? (
            <ErrorState title="Couldn't load coupons" onRetry={() => refetch()} />
          ) : data?.length === 0 ? (
            <EmptyState title="No coupons yet" hint="Create your first code to start offering discounts." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Coupons</caption>
                <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/55">
                  <tr>
                    <th scope="col" className="text-left px-4 py-2.5 font-semibold">Code</th>
                    <th scope="col" className="text-left px-4 py-2.5 font-semibold">Discount</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-semibold">Min order</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-semibold">Used</th>
                    <th scope="col" className="text-right px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBD9BC]">
                  {data?.map((c) => (
                    <tr key={c.code} className={cn('hover:bg-[#F3E7D0]/40', !c.active && 'opacity-60')}>
                      <td className="px-4 py-2 font-mono font-semibold">{c.code}</td>
                      <td className="px-4 py-2">
                        {c.type === 'percent' ? `${c.value}% off` : `${formatPaise(c.value)} off`}
                        {c.maxDiscountPaise && (
                          <span className="text-[#483828]/50"> · max {formatPaise(c.maxDiscountPaise)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right tabular">
                        {c.minOrderPaise > 0 ? formatPaise(c.minOrderPaise) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular">
                        {c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {isOwner ? (
                          <Button
                            compact variant="secondary"
                            onClick={() => toggle.mutate({ code: c.code, active: !c.active })}
                          >
                            {c.active ? 'Disable' : 'Enable'}
                          </Button>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#483828]/55">
                            {c.active ? 'Enabled' : 'Disabled'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4 h-fit order-1 lg:order-2">
          <h2 className="text-sm font-semibold">Create coupon</h2>
          {!isOwner ? (
            <p className="text-xs text-[#483828]/70 mt-2">
              Only the owner can create or change coupons. You can see existing codes here.
            </p>
          ) : (
            <form
              className="space-y-3 mt-3"
              onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
            >
              <Field
                label="Coupon code" id="coupon-code" required
                value={form.code} onChange={(v) => setForm({ ...form, code: v })}
                hint="Stored uppercase. Customers may type it either way."
              />
              <div>
                <label htmlFor="coupon-type" className="block text-xs font-semibold mb-1">Discount type</label>
                <select
                  id="coupon-type" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] px-3 text-sm"
                >
                  <option value="percent">Percentage</option>
                  <option value="flat">Flat ₹</option>
                </select>
              </div>
              <Field
                label={form.type === 'percent' ? 'Percent off' : 'Amount off (₹)'}
                id="coupon-value" required
                value={form.value} onChange={(v) => setForm({ ...form, value: v })}
              />
              <Field
                label="Minimum order (₹)" id="coupon-min"
                value={form.minOrder} onChange={(v) => setForm({ ...form, minOrder: v })}
                hint="0 for no minimum."
              />
              {form.type === 'percent' && (
                <Field
                  label="Maximum discount (₹)" id="coupon-cap"
                  value={form.maxDiscount} onChange={(v) => setForm({ ...form, maxDiscount: v })}
                  hint="Caps a percentage coupon on a large order."
                />
              )}
              <Button type="submit" className="w-full" disabled={create.isPending || !form.code.trim()}>
                {create.isPending ? 'Creating…' : 'Create coupon'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
};
