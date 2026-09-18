import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, Star } from 'lucide-react';
import { adminApi, type AdminReview } from '../api/client';
import { PageHeader, Card, FilterTabs } from '../components/ui/Layout';
import { SkeletonCards, EmptyState, ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

/**
 * Approval queue, unapproved first. An open review form on a food product is
 * a spam magnet, and approving recomputes the product's rating from real
 * rows. See docs/ADMIN.md §4.7.
 */
export const AdminReviewsPage: React.FC = () => {
  const [filter, setFilter] = useState('pending');
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: adminApi.reviews,
  });

  const moderate = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) =>
      adminApi.setReviewApproved(id, approved),
    onSuccess: (_r, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      notify({
        tone: 'success',
        title: approved ? 'Review approved.' : 'Review unapproved.',
        detail: approved ? "It is now live on the product page." : 'It is hidden from the storefront.',
      });
    },
    onError: (e: Error) => notify({ tone: 'error', title: "Couldn't update review", detail: e.message }),
  });

  const all = data ?? [];
  const rows = useMemo(() => {
    if (filter === 'pending') return all.filter((r) => !r.approved);
    if (filter === 'approved') return all.filter((r) => r.approved);
    return all;
  }, [all, filter]);

  const Row: React.FC<{ r: AdminReview }> = ({ r }) => (
    <li className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">{r.name}</span>
          <span className="text-[#483828]/50">{r.productName}</span>
          <span className="inline-flex items-center gap-0.5 text-[#B69A55]" aria-label={`${r.rating} out of 5`}>
            {Array.from({ length: r.rating }, (_, i) => (
              <Star key={i} size={12} aria-hidden="true" fill="currentColor" />
            ))}
          </span>
          <span className="tabular text-[#483828]/45">
            {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        <p className="text-sm text-[#483828]/85 mt-1.5 leading-relaxed">{r.comment}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        {r.approved ? (
          <Button compact variant="secondary" onClick={() => moderate.mutate({ id: r.id, approved: false })}>
            <X size={13} aria-hidden="true" /> Unapprove
          </Button>
        ) : (
          <Button compact onClick={() => moderate.mutate({ id: r.id, approved: true })}>
            <Check size={13} aria-hidden="true" /> Approve
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <>
      <PageHeader title="Reviews" subtitle="Keep only genuine, helpful reviews on the storefront." />

      <FilterTabs
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'pending', label: 'Awaiting approval', count: all.filter((r) => !r.approved).length },
          { value: 'approved', label: 'Published', count: all.filter((r) => r.approved).length },
          { value: 'all', label: 'All', count: all.length },
        ]}
      />

      <Card className={cn('mt-4 overflow-hidden')}>
        {isLoading ? (
          <div className="p-4"><SkeletonCards count={4} /></div>
        ) : isError ? (
          <ErrorState title="Couldn't load reviews" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filter === 'pending' ? 'Nothing waiting' : 'No reviews here'}
            hint={filter === 'pending' ? 'Every review has been moderated.' : undefined}
          />
        ) : (
          <ul className="divide-y divide-[#EBD9BC]">
            {rows.map((r) => <Row key={r.id} r={r} />)}
          </ul>
        )}
      </Card>
    </>
  );
};
