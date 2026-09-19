/**
 * Order history for a signed-in customer.
 *
 * Everything here is scoped server-side to the session's customer id, never
 * to a phone number sent by the browser — otherwise anyone could read anyone
 * else's orders by typing a number.
 */
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { api, ApiRequestError } from '../api/client';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'On its way', delivered: 'Delivered', cancelled: 'Cancelled',
  failed: 'Payment failed', rto: 'Returned to us', returned: 'Returned',
  refunded: 'Refunded',
};

export default function AccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state } = useLocation() as { state?: { justSignedIn?: boolean; ordersLinked?: number } };

  const me = useQuery({ queryKey: ['me'], queryFn: () => api.me() });
  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.myOrders(),
    enabled: Boolean(me.data),
    retry: false,
  });

  if (me.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><div className="h-6 w-40 animate-pulse rounded bg-[#EBD9BC]" /></div>;
  }

  if (!me.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-bold text-[#483828]">You’re not signed in</h1>
        <p className="mt-2 text-sm text-[#483828]/70">Sign in to see your orders.</p>
        <Link
          to="/login?next=/account"
          className="mt-5 inline-flex min-h-12 items-center rounded-md bg-[#87380F] px-6 text-sm font-semibold tracking-wider text-[#FAF6F0] hover:bg-[#662707]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const signOut = async () => {
    await api.logout();
    // Both caches, or the next visitor to this browser sees the last one's data.
    queryClient.removeQueries({ queryKey: ['me'] });
    queryClient.removeQueries({ queryKey: ['my-orders'] });
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#483828]">Your orders</h1>
          <p className="mt-1 text-sm text-[#483828]/70">Signed in as +91 {me.data.phone}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex min-h-11 items-center rounded-md border border-[#EBD9BC] px-4 text-xs font-semibold text-[#483828] transition-colors hover:border-[#87380F] hover:text-[#87380F]"
        >
          Sign out
        </button>
      </div>

      {state?.justSignedIn && (state.ordersLinked ?? 0) > 0 && (
        <p className="mt-5 rounded-md border border-[#647044]/30 bg-[#647044]/10 p-3 text-xs font-medium text-[#3f4a26]">
          We found {state.ordersLinked} earlier order{state.ordersLinked === 1 ? '' : 's'} placed with this
          number and added {state.ordersLinked === 1 ? 'it' : 'them'} below.
        </p>
      )}

      {orders.isLoading ? (
        <ul className="mt-8 space-y-3">
          {[0, 1].map((i) => <li key={i} className="h-24 animate-pulse rounded-lg bg-[#EBD9BC]/60" />)}
        </ul>
      ) : orders.isError ? (
        <div className="mt-8 rounded-lg border border-[#A33A28]/30 bg-[#FBEDEA] p-4">
          <p className="text-sm text-[#A33A28]">
            {orders.error instanceof ApiRequestError ? orders.error.message : 'Could not load your orders.'}
          </p>
          <button onClick={() => orders.refetch()} className="mt-2 min-h-11 text-xs font-semibold text-[#87380F] underline">
            Try again
          </button>
        </div>
      ) : (orders.data ?? []).length === 0 ? (
        <div className="mt-8 rounded-lg border border-[#EBD9BC] bg-white p-8 text-center">
          <p className="text-sm text-[#483828]/70">No orders yet.</p>
          <Link
            to="/shop"
            className="mt-4 inline-flex min-h-12 items-center rounded-md bg-[#87380F] px-6 text-sm font-semibold tracking-wider text-[#FAF6F0] hover:bg-[#662707]"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {(orders.data ?? []).map((o) => (
            <li key={o.orderNumber} className="rounded-lg border border-[#EBD9BC] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  to={`/order/${o.orderNumber}`}
                  className="inline-flex min-h-11 items-center font-mono text-sm font-semibold text-[#87380F] hover:underline"
                >
                  {o.orderNumber}
                </Link>
                <span className="text-xs font-semibold text-[#483828]/70">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </div>

              <p className="mt-1 text-xs text-[#483828]/60">
                {new Date(o.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {' · '}
                {o.items.reduce((n, i) => n + i.quantity, 0)} item
                {o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}
                {' · '}
                <span className="font-semibold text-[#483828]">{formatPaise(o.totalPaise)}</span>
              </p>

              <ul className="mt-2 space-y-0.5">
                {o.items.map((i, n) => (
                  <li key={n} className="text-xs text-[#483828]/70">
                    {i.quantity} × {i.productName} <span className="text-[#483828]/45">({i.weight})</span>
                  </li>
                ))}
              </ul>

              {o.trackingNumber && (
                <p className="mt-2 font-mono text-[11px] text-[#483828]/60">
                  {o.courier} · {o.trackingNumber}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
