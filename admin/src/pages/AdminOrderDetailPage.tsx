import React, { useState } from 'react';
import { useParams, useNavigate, useOutletContext, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Copy, Check, Truck, PackageCheck, X } from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { adminApi, type AdminIdentity } from '../api/client';
import { Card, SectionTitle } from '../components/ui/Layout';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ErrorState } from '../components/ui/States';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

const NEXT_LABEL: Record<string, string> = {
  confirmed: 'Mark confirmed',
  packed: 'Mark as packed',
  shipped: 'Add tracking & ship',
  delivered: 'Mark delivered',
  cancelled: 'Cancel order',
  rto: 'Mark returned to origin',
  returned: 'Mark returned',
};

export const AdminOrderDetailPage: React.FC = () => {
  const { orderNumber = '' } = useParams();
  const navigate = useNavigate();
  const me = useOutletContext<AdminIdentity | undefined>();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [copied, setCopied] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundConfirm, setRefundConfirm] = useState('');

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'order', orderNumber],
    queryFn: () => adminApi.order(orderNumber),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  const setStatus = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminApi.setStatus(orderNumber, body),
    onSuccess: (_r, body) => {
      invalidate();
      const to = String((body as { status: string }).status);
      notify({
        tone: 'success',
        title: `Order ${orderNumber} marked as ${to}.`,
        detail: to === 'shipped' ? 'The customer has been notified.' : undefined,
      });
      setTrackingOpen(false);
    },
    // The row reverts because the query refetches; the toast says so plainly.
    onError: (e: Error) =>
      notify({ tone: 'error', title: "Couldn't update order. Reverting…", detail: e.message }),
  });

  const refund = useMutation({
    mutationFn: () => adminApi.refund(orderNumber, { reason: 'Refunded from admin' }),
    onSuccess: () => {
      invalidate();
      setRefundOpen(false);
      notify({ tone: 'success', title: `Order ${orderNumber} refunded.` });
    },
    onError: (e: Error) => notify({ tone: 'error', title: "Refund failed", detail: e.message }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading order">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-7 w-56" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="skeleton h-64 lg:col-span-2 rounded-lg" />
          <div className="skeleton h-64 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !order) {
    return <Card><ErrorState title="Couldn't load this order" onRetry={() => refetch()} /></Card>;
  }

  const address = `${order.customerName}\n${order.address}${order.landmark ? `, ${order.landmark}` : ''}\n${order.city}, ${order.state} ${order.pincode}\n${order.phone}`;

  const copyAddress = async () => {
    await navigator.clipboard?.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const next = order.allowedTransitions;
  const primaryNext = next.includes('packed') ? 'packed' : next.includes('shipped') ? 'shipped' : next[0];

  const doTransition = (to: string) => {
    if (to === 'shipped') { setTrackingOpen(true); return; }
    setStatus.mutate({ status: to });
  };

  return (
    <div className="pb-20 lg:pb-0">
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="inline-flex items-center gap-1 min-h-11 -ml-1 px-1 text-xs text-[#87380F] hover:underline"
      >
        <ChevronLeft size={15} aria-hidden="true" /> Back to orders
      </button>

      <div className="flex flex-wrap items-center gap-2.5 mt-1 mb-5">
        <h1 className="font-mono text-xl font-bold">{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <StatusBadge status={order.paymentStatus} kind="payment" />
        <span className="text-xs text-[#483828]/55 tabular">
          {new Date(order.createdAt).toLocaleString('en-IN')}
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <SectionTitle>Items</SectionTitle>
            <table className="w-full text-sm">
              <caption className="sr-only">Order items</caption>
              <thead className="text-[11px] uppercase tracking-wider text-[#483828]/55">
                <tr>
                  <th scope="col" className="text-left px-4 py-2 font-semibold">Product</th>
                  <th scope="col" className="text-right px-4 py-2 font-semibold">Price</th>
                  <th scope="col" className="text-right px-4 py-2 font-semibold">Qty</th>
                  <th scope="col" className="text-right px-4 py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBD9BC]">
                {order.items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2.5">
                      {i.productName}
                      <span className="text-[#483828]/55"> ({i.weight})</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{formatPaise(i.unitPricePaise)}</td>
                    <td className="px-4 py-2.5 text-right tabular text-[#483828]/70">{i.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular font-semibold">{formatPaise(i.lineTotalPaise)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#EBD9BC] text-xs">
                <tr>
                  <td className="px-4 py-1.5 text-[#483828]/60" colSpan={3}>Subtotal</td>
                  <td className="px-4 py-1.5 text-right tabular">{formatPaise(order.subtotalPaise)}</td>
                </tr>
                {order.discountPaise > 0 && (
                  <tr>
                    <td className="px-4 py-1.5 text-[#483828]/60" colSpan={3}>
                      Discount {order.couponCode && <span className="font-mono">({order.couponCode})</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular">−{formatPaise(order.discountPaise)}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-1.5 text-[#483828]/60" colSpan={3}>Shipping</td>
                  <td className="px-4 py-1.5 text-right tabular">{formatPaise(order.shippingPaise)}</td>
                </tr>
                <tr className="text-sm font-bold">
                  <td className="px-4 py-2.5" colSpan={3}>Total</td>
                  <td className="px-4 py-2.5 text-right tabular text-[#87380F]">{formatPaise(order.totalPaise)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card>
            <SectionTitle>Timeline</SectionTitle>
            {order.auditTrail.length === 0 ? (
              <p className="px-4 py-5 text-xs text-[#483828]/55">No changes recorded yet.</p>
            ) : (
              <ol className="px-4 py-3 space-y-3">
                {order.auditTrail.map((a, i) => (
                  <li key={i} className="flex gap-3 text-xs">
                    <span aria-hidden="true" className="mt-1 w-2 h-2 rounded-full bg-[#87380F] shrink-0" />
                    <span className="flex-1">
                      <span className="font-semibold capitalize">
                        {String((a.after as { status?: string })?.status ?? a.action.replace(/\./g, ' '))}
                      </span>
                      <span className="block text-[#483828]/60 mt-0.5">
                        {a.adminEmail ?? 'System'} · {new Date(a.createdAt).toLocaleString('en-IN')}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-semibold">Ship to</h2>
              <button
                type="button"
                onClick={copyAddress}
                className="inline-flex items-center gap-1.5 min-h-11 px-2.5 -my-2 rounded-md border border-[#EBD9BC] text-[11px] font-semibold hover:bg-[#F3E7D0]/60"
              >
                {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 text-sm font-medium">{order.customerName}</p>
            <p className="text-xs text-[#483828]/75 leading-relaxed mt-0.5">
              {order.address}{order.landmark ? `, ${order.landmark}` : ''}<br />
              {order.city}, {order.state} — {order.pincode}
            </p>
            <p className="tabular text-xs text-[#483828]/75 mt-1">{order.phone}</p>
            <span aria-live="polite" className="sr-only">{copied ? 'Address copied' : ''}</span>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-2">Payment</h2>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between gap-3">
                <dt className="text-[#483828]/60">Method</dt>
                <dd className="uppercase">{order.paymentMethod}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#483828]/60">Status</dt>
                <dd><StatusBadge status={order.paymentStatus} kind="payment" /></dd>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#483828]/60">Transaction</dt>
                  <dd className="font-mono text-[11px] truncate max-w-36">{order.razorpayPaymentId}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3 font-semibold">
                <dt>Amount</dt>
                <dd className="tabular">{formatPaise(order.totalPaise)}</dd>
              </div>
            </dl>
          </Card>

          {/* Desktop next action. Mobile gets a sticky bar instead. */}
          <Card className="p-4 hidden lg:block">
            <h2 className="text-sm font-semibold mb-1">Next step</h2>
            {next.length === 0 ? (
              <p className="text-xs text-[#483828]/60">This order is in a final state.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {next.map((t) => (
                  <Button
                    key={t}
                    compact
                    variant={t === primaryNext ? 'primary' : 'secondary'}
                    disabled={setStatus.isPending}
                    onClick={() => doTransition(t)}
                  >
                    {t === 'packed' && <PackageCheck size={14} aria-hidden="true" />}
                    {t === 'shipped' && <Truck size={14} aria-hidden="true" />}
                    {NEXT_LABEL[t] ?? `Mark ${t}`}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          {order.paymentStatus !== 'refunded' && (
            <Card className="p-4 border-[#A33A28]/30">
              <h2 className="text-sm font-semibold text-[#A33A28]">Refund</h2>
              {me?.role === 'owner' ? (
                <>
                  <p className="text-xs text-[#483828]/70 mt-1 mb-3">
                    Returns {formatPaise(order.totalPaise)} to the customer. This cannot be undone.
                  </p>
                  <Button variant="danger" compact onClick={() => setRefundOpen(true)}>
                    Process refund
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-[#483828]/70 mt-1 mb-3">
                    Only owners can issue refunds.
                  </p>
                  <Button variant="danger" compact disabled>Process refund</Button>
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Mobile: the next action sits in the thumb zone. */}
      {next.length > 0 && (
        <div
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          className="lg:hidden fixed bottom-14 inset-x-0 z-20 border-t border-[#EBD9BC] bg-white px-4 pt-2"
        >
          <Button
            className="w-full"
            disabled={setStatus.isPending}
            onClick={() => doTransition(primaryNext!)}
          >
            {primaryNext === 'packed' && <PackageCheck size={15} aria-hidden="true" />}
            {primaryNext === 'shipped' && <Truck size={15} aria-hidden="true" />}
            {NEXT_LABEL[primaryNext!] ?? `Mark ${primaryNext}`}
          </Button>
        </div>
      )}

      {trackingOpen && (
        <Modal title="Add tracking" onClose={() => setTrackingOpen(false)}>
          <div className="space-y-3">
            <Field label="Tracking number" value={tracking} onChange={setTracking} id="tracking-number" />
            <Field label="Courier" value={courier} onChange={setCourier} id="tracking-courier" />
            <p className="text-[11px] text-[#483828]/60">
              Saving marks this order shipped and notifies the customer.
            </p>
            <div className="flex gap-2 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setTrackingOpen(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!tracking.trim() || setStatus.isPending}
                onClick={() => setStatus.mutate({
                  status: 'shipped',
                  trackingNumber: tracking.trim(),
                  courier: courier.trim() || undefined,
                })}
              >
                Save tracking
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {refundOpen && (
        <Modal title="Process refund" onClose={() => setRefundOpen(false)} danger>
          <p className="text-xs text-[#483828]/75">
            This will refund {formatPaise(order.totalPaise)} to the customer. It cannot be undone.
          </p>
          <label htmlFor="refund-confirm" className="block text-xs font-semibold mt-3 mb-1">
            Type the order number to confirm
          </label>
          <input
            id="refund-confirm"
            value={refundConfirm}
            onChange={(e) => setRefundConfirm(e.target.value)}
            placeholder={order.orderNumber}
            className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] px-3 font-mono text-sm"
          />
          <div className="flex gap-2 mt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={refundConfirm !== order.orderNumber || refund.isPending}
              onClick={() => refund.mutate()}
            >
              Refund {formatPaise(order.totalPaise)}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; id: string }> = ({
  label, value, onChange, id,
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold mb-1">{label}</label>
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-[#FAF6F0] px-3 text-sm"
    />
  </div>
);

/** Esc closes; focus is trapped by rendering nothing else interactive behind. */
const Modal: React.FC<{
  title: string;
  onClose: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, danger, children }) => (
  <div
    className="fixed inset-0 z-50 grid place-items-end lg:place-items-center"
    onKeyDown={(e) => e.key === 'Escape' && onClose()}
  >
    <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[#483828]/40" />
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="relative w-full lg:max-w-sm rounded-t-xl lg:rounded-xl bg-white p-4 lg:p-5"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className={cn('text-sm font-semibold', danger && 'text-[#A33A28]')}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid place-items-center min-h-11 min-w-11 -m-2 rounded-md hover:bg-[#F3E7D0]/60"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
