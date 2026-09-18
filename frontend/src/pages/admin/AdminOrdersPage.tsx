import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminIdentity } from '../../api/admin';
import { useOutletContext } from 'react-router-dom';

/** Status is colour AND text — colour alone fails WCAG and fails a printout. */
const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const tone: Record<string, string> = {
    pending: 'bg-[#B69A55]/15 text-[#7a6221]',
    confirmed: 'bg-[#647044]/15 text-[#42522a]',
    packed: 'bg-[#647044]/20 text-[#42522a]',
    shipped: 'bg-[#87380F]/12 text-[#87380F]',
    delivered: 'bg-[#647044]/25 text-[#33421f]',
    cancelled: 'bg-[#483828]/10 text-[#483828]/70',
    failed: 'bg-[#87380F]/15 text-[#87380F]',
    refunded: 'bg-[#483828]/10 text-[#483828]/70',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${tone[status] ?? 'bg-[#483828]/10'}`}>
      {status}
    </span>
  );
};

export const AdminOrdersPage: React.FC = () => {
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () => adminApi.orders(status ? { status } : {}),
  });

  const filters = ['', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'failed'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setStatus(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              status === f ? 'bg-[#87380F] text-white' : 'bg-white border border-[#EBD9BC] hover:bg-[#F3E7D0]/50'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#EBD9BC] rounded-lg overflow-x-auto">
        {isLoading ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60" role="status">Loading orders…</p>
        ) : data?.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[#483828]/60">No orders match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#FAF6F0] text-[11px] uppercase tracking-wider text-[#483828]/60">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold">Order</th>
                <th className="text-left px-4 py-2.5 font-semibold">Customer</th>
                <th className="text-left px-4 py-2.5 font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 font-semibold">Payment</th>
                <th className="text-right px-4 py-2.5 font-semibold">Total</th>
                <th className="text-right px-4 py-2.5 font-semibold">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBD9BC]">
              {data?.map((o) => (
                <tr key={o.orderNumber} className="hover:bg-[#FAF6F0]/60">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/orders/${o.orderNumber}`} className="font-mono text-[#87380F] hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {o.customerName}
                    <span className="text-[#483828]/50"> · {o.city}</span>
                  </td>
                  <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-2.5 text-xs uppercase">
                    {o.paymentMethod}
                    <span className="text-[#483828]/50"> / {o.paymentStatus}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {formatPaise(o.totalPaise)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#483828]/60 text-xs">
                    {new Date(o.createdAt).toLocaleDateString('en-IN')}
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

export const AdminOrderDetailPage: React.FC = () => {
  const { orderNumber = '' } = useParams();
  const navigate = useNavigate();
  const me = useOutletContext<AdminIdentity | undefined>();
  const queryClient = useQueryClient();

  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [refundConfirm, setRefundConfirm] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'order', orderNumber],
    queryFn: () => adminApi.order(orderNumber),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const setStatus = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.setStatus(orderNumber, body),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  const refund = useMutation({
    mutationFn: () => adminApi.refund(orderNumber, { reason: 'Refunded from admin' }),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });

  if (isLoading) return <p className="text-sm text-[#483828]/60" role="status">Loading…</p>;
  if (!order) return <p className="text-sm">Order not found.</p>;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/admin/orders')} className="text-xs text-[#87380F] hover:underline">
        ← All orders
      </button>

      <div className="flex items-center gap-3">
        <h1 className="font-mono text-lg font-semibold">{order.orderNumber}</h1>
        <StatusPill status={order.status} />
        <span className="text-xs uppercase text-[#483828]/60">
          {order.paymentMethod} / {order.paymentStatus}
        </span>
      </div>

      {actionError && (
        <p role="alert" className="text-xs text-[#87380F] bg-[#87380F]/8 border border-[#87380F]/25 rounded p-2.5">
          {actionError}
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <section className="md:col-span-2 bg-white border border-[#EBD9BC] rounded-lg">
          <h2 className="px-4 py-2.5 border-b border-[#EBD9BC] text-sm font-semibold">Items</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[#EBD9BC]">
              {order.items.map((i, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2.5">{i.productName} <span className="text-[#483828]/50">({i.weight})</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#483828]/70">× {i.quantity}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatPaise(i.lineTotalPaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-[#EBD9BC] text-xs">
              <tr><td className="px-4 py-1.5 text-[#483828]/60" colSpan={2}>Subtotal</td><td className="px-4 py-1.5 text-right tabular-nums">{formatPaise(order.subtotalPaise)}</td></tr>
              {order.discountPaise > 0 && (
                <tr><td className="px-4 py-1.5 text-[#483828]/60" colSpan={2}>Discount {order.couponCode && `(${order.couponCode})`}</td><td className="px-4 py-1.5 text-right tabular-nums">−{formatPaise(order.discountPaise)}</td></tr>
              )}
              <tr><td className="px-4 py-1.5 text-[#483828]/60" colSpan={2}>Shipping</td><td className="px-4 py-1.5 text-right tabular-nums">{formatPaise(order.shippingPaise)}</td></tr>
              <tr className="font-bold text-sm"><td className="px-4 py-2" colSpan={2}>Total</td><td className="px-4 py-2 text-right tabular-nums text-[#87380F]">{formatPaise(order.totalPaise)}</td></tr>
            </tfoot>
          </table>
        </section>

        <section className="bg-white border border-[#EBD9BC] rounded-lg p-4 text-sm space-y-1">
          <h2 className="text-sm font-semibold mb-2">Ship to</h2>
          <p className="font-medium">{order.customerName}</p>
          <p className="text-[#483828]/75 leading-relaxed">
            {order.address}{order.landmark ? `, near ${order.landmark}` : ''}<br />
            {order.city}, {order.state} — {order.pincode}
          </p>
          <p className="text-[#483828]/75 tabular-nums">{order.phone}</p>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(
              `${order.customerName}\n${order.address}\n${order.city}, ${order.state} ${order.pincode}\n${order.phone}`,
            )}
            className="mt-3 text-xs px-3 py-1.5 border border-[#EBD9BC] rounded hover:bg-[#F3E7D0]/50"
          >
            Copy address
          </button>
        </section>
      </div>

      <section className="bg-white border border-[#EBD9BC] rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Next step</h2>
        {order.allowedTransitions.length === 0 ? (
          <p className="text-xs text-[#483828]/60">This order is in a final state.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {order.allowedTransitions.includes('shipped') && (
              <>
                <label className="text-xs">
                  <span className="block mb-1 text-[#483828]/70">Tracking number</span>
                  <input value={tracking} onChange={(e) => setTracking(e.target.value)}
                    className="border border-[#EBD9BC] rounded px-2 py-1.5 text-sm bg-[#FAF6F0]" />
                </label>
                <label className="text-xs">
                  <span className="block mb-1 text-[#483828]/70">Courier</span>
                  <input value={courier} onChange={(e) => setCourier(e.target.value)}
                    className="border border-[#EBD9BC] rounded px-2 py-1.5 text-sm bg-[#FAF6F0]" />
                </label>
              </>
            )}
            {order.allowedTransitions.map((t) => (
              <button
                key={t}
                disabled={setStatus.isPending}
                onClick={() => {
                  setActionError(null);
                  setStatus.mutate(
                    t === 'shipped' ? { status: t, trackingNumber: tracking || undefined, courier: courier || undefined } : { status: t },
                  );
                }}
                className="px-3 py-1.5 bg-[#87380F] hover:bg-[#6d2d0c] disabled:opacity-50 text-white rounded text-xs font-semibold uppercase tracking-wide"
              >
                Mark {t}
              </button>
            ))}
          </div>
        )}
      </section>

      {me?.role === 'owner' && order.paymentStatus !== 'refunded' && (
        <section className="bg-white border border-[#87380F]/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[#87380F] mb-1">Refund</h2>
          <p className="text-xs text-[#483828]/70 mb-3">
            Type the order number to confirm. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <input
              value={refundConfirm}
              onChange={(e) => setRefundConfirm(e.target.value)}
              placeholder={order.orderNumber}
              className="border border-[#EBD9BC] rounded px-2 py-1.5 text-sm font-mono bg-[#FAF6F0]"
            />
            <button
              disabled={refundConfirm !== order.orderNumber || refund.isPending}
              onClick={() => { setActionError(null); refund.mutate(); }}
              className="px-3 py-1.5 bg-[#87380F] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-semibold uppercase tracking-wide"
            >
              Refund {formatPaise(order.totalPaise)}
            </button>
          </div>
        </section>
      )}

      <section className="bg-white border border-[#EBD9BC] rounded-lg">
        <h2 className="px-4 py-2.5 border-b border-[#EBD9BC] text-sm font-semibold">History</h2>
        {order.auditTrail.length === 0 ? (
          <p className="px-4 py-4 text-xs text-[#483828]/60">No changes recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[#EBD9BC] text-xs">
            {order.auditTrail.map((a, i) => (
              <li key={i} className="px-4 py-2 flex justify-between gap-4">
                <span>
                  <span className="font-semibold">{a.action}</span>{' '}
                  <span className="text-[#483828]/60">by {a.adminEmail ?? 'system'}</span>
                </span>
                <span className="text-[#483828]/50 tabular-nums shrink-0">
                  {new Date(a.createdAt).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
