import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/client';

/**
 * Approval queue, unapproved first. An open review form on a food product is
 * a spam magnet, so nothing appears on the storefront until it is approved —
 * and approving recomputes the product's rating. See docs/ADMIN.md §4.7.
 */
export const AdminReviewsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin', 'reviews'], queryFn: adminApi.reviews });

  const setApproved = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      adminApi.setReviewApproved(id, approved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
    onError: (e: Error) => setError(e.message),
  });

  const pending = (data ?? []).filter((r) => !r.approved);
  const approved = (data ?? []).filter((r) => r.approved);

  const Row: React.FC<{ r: NonNullable<typeof data>[number] }> = ({ r }) => (
    <li className="px-4 py-3 flex gap-4 items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold">{r.name}</span>
          <span className="text-[#483828]/50">{r.productName}</span>
          <span className="tabular-nums text-[#B69A55]">{'★'.repeat(r.rating)}</span>
        </div>
        <p className="text-sm text-[#483828]/80 mt-1">{r.comment}</p>
      </div>
      <button
        onClick={() => { setError(null); setApproved.mutate({ id: r.id, approved: !r.approved }); }}
        className={`shrink-0 text-[11px] px-2.5 py-1 rounded font-semibold uppercase tracking-wide ${
          r.approved
            ? 'border border-[#EBD9BC] hover:bg-[#F3E7D0]/50'
            : 'bg-[#647044] hover:bg-[#4d5733] text-white'
        }`}
      >
        {r.approved ? 'Unapprove' : 'Approve'}
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-xs text-[#87380F] bg-[#87380F]/8 border border-[#87380F]/25 rounded p-2.5">
          {error}
        </p>
      )}

      <section className="bg-white border border-[#EBD9BC] rounded-lg">
        <h2 className="px-4 py-2.5 border-b border-[#EBD9BC] text-sm font-semibold">
          Awaiting approval {pending.length > 0 && <span className="text-[#87380F]">({pending.length})</span>}
        </h2>
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60" role="status">Loading reviews…</p>
        ) : pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">Nothing waiting.</p>
        ) : (
          <ul className="divide-y divide-[#EBD9BC]">{pending.map((r) => <Row key={r.id} r={r} />)}</ul>
        )}
      </section>

      <section className="bg-white border border-[#EBD9BC] rounded-lg">
        <h2 className="px-4 py-2.5 border-b border-[#EBD9BC] text-sm font-semibold">
          Published ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">None published yet.</p>
        ) : (
          <ul className="divide-y divide-[#EBD9BC]">{approved.map((r) => <Row key={r.id} r={r} />)}</ul>
        )}
      </section>
    </div>
  );
};
