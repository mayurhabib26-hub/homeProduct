import React, { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatPaise } from '@sv/shared';
import { CheckCircle2, Package, Truck, Phone } from 'lucide-react';
import { api } from '../api/client';
import { whatsappUrl } from '../lib/contact';
import { ErrorState } from '../components/QueryStates';

/**
 * Order confirmation and tracking, one page.
 *
 * Reached straight after checkout, or later from /track. Either way it asks
 * for the phone number the order was placed with: an order number alone is
 * not an authenticator, and without the check this page would leak customer
 * addresses to anyone who can enumerate. See docs/API.md §4.
 */
export const OrderConfirmationPage: React.FC = () => {
  const { orderNumber = '' } = useParams<{ orderNumber: string }>();
  const location = useLocation() as { state?: { justPlaced?: boolean } };
  const justPlaced = Boolean(location.state?.justPlaced);

  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['order', orderNumber, submitted],
    queryFn: () => api.orders.track(orderNumber, submitted),
    enabled: submitted.length === 10,
    retry: false,
  });

  const steps = [
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
    { key: 'packed', label: 'Packed', icon: Package },
    { key: 'shipped', label: 'Shipped', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-12 md:py-20 font-sans">
      <div className="max-w-2xl mx-auto px-4">
        {justPlaced && (
          <div className="bg-white p-8 rounded-2xl border border-[#EBD9BC] shadow-md text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#647044]/15 text-[#647044] flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <span className="block text-xs uppercase tracking-widest font-semibold text-[#87380F] mt-4">
              Order Confirmed
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828] mt-1">
              Thank you!
            </h1>
            <p className="text-sm text-[#483828]/80 mt-2">
              Your order{' '}
              <strong className="text-[#87380F] font-mono">{orderNumber}</strong>{' '}
              is with our family kitchen and is being prepared for dispatch.
            </p>
            <a
              href={whatsappUrl(`Namaste S V Home Products! I just placed order ${orderNumber}. Please confirm dispatch.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full mt-6 py-3.5 bg-[#647044] hover:bg-[#4d5733] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
            >
              <Phone size={15} />
              <span>Confirm &amp; track on WhatsApp</span>
            </a>
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EBD9BC] shadow-xs">
          <h2 className="font-serif text-xl font-bold text-[#483828]">
            {justPlaced ? 'Track this order' : 'Track your order'}
          </h2>
          <p className="text-xs text-[#483828]/70 mt-1">
            Enter the phone number used when ordering.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(phone.replace(/\D/g, '').slice(-10));
            }}
            className="mt-4 flex gap-2"
          >
            <label htmlFor="track-phone" className="sr-only">
              Phone number
            </label>
            <input
              id="track-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-sm text-[#483828] focus:outline-none focus:border-[#87380F]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#87380F] hover:bg-[#6d2d0c] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
            >
              Track
            </button>
          </form>

          {isLoading && submitted && (
            <p className="mt-4 text-xs text-[#483828]/70" role="status">
              Looking up your order…
            </p>
          )}

          {isError && (
            <p role="alert" className="mt-4 text-xs text-[#87380F]">
              {(error as Error)?.message ?? 'We could not find that order.'}
            </p>
          )}

          {order && (
            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-[#87380F]">{order.orderNumber}</span>
                <span className="uppercase tracking-wider font-semibold text-[#483828]">
                  {order.status}
                </span>
              </div>

              <ol className="flex items-center justify-between gap-1">
                {steps.map((step, i) => {
                  const reachedIndex = steps.findIndex((s) => s.key === order.status);
                  const done = reachedIndex >= i && reachedIndex !== -1;
                  return (
                    <li key={step.key} className="flex-1 text-center">
                      <step.icon
                        size={18}
                        className={`mx-auto ${done ? 'text-[#647044]' : 'text-[#483828]/25'}`}
                      />
                      <span
                        className={`block text-[10px] mt-1 uppercase tracking-wider ${
                          done ? 'text-[#483828] font-semibold' : 'text-[#483828]/40'
                        }`}
                      >
                        {step.label}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {order.trackingNumber && (
                <p className="text-xs text-[#483828]/80">
                  {order.courier} &middot;{' '}
                  <span className="font-mono">{order.trackingNumber}</span>
                </p>
              )}

              <ul className="divide-y divide-[#EBD9BC] border-y border-[#EBD9BC]">
                {order.items.map((item, i) => (
                  <li key={i} className="py-3 flex justify-between text-xs">
                    <span className="text-[#483828]">
                      {item.name} ({item.weight}) &times; {item.quantity}
                    </span>
                    <span className="font-semibold text-[#483828]">
                      {formatPaise(item.lineTotalPaise)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-between text-sm font-bold text-[#87380F]">
                <span>Total</span>
                <span>{formatPaise(order.totals.totalPaise)}</span>
              </div>
            </div>
          )}
        </div>

        {!justPlaced && !order && !isError && (
          <div className="mt-6 text-center">
            <Link to="/shop" className="text-xs text-[#87380F] font-semibold hover:underline">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export const TrackOrderPage: React.FC = () => {
  const [orderNumber, setOrderNumber] = useState('');
  const [go, setGo] = useState(false);

  if (go && /^SV-\d{4}-\d{5}$/.test(orderNumber.trim().toUpperCase())) {
    return <ErrorState message="Redirecting…" />;
  }

  return (
    <div className="bg-[#FAF6F0] min-h-[60vh] py-16 font-sans">
      <div className="max-w-md mx-auto px-4">
        <h1 className="font-serif text-3xl font-bold text-[#483828]">Track an order</h1>
        <p className="text-sm text-[#483828]/75 mt-2">
          Enter the order number from your confirmation, e.g. SV-2609-01000.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGo(true);
          }}
          className="mt-6 flex gap-2"
        >
          <label htmlFor="order-number" className="sr-only">
            Order number
          </label>
          <input
            id="order-number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="SV-2609-01000"
            className="flex-1 bg-white border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#87380F]"
          />
          <Link
            to={`/order/${orderNumber.trim().toUpperCase()}`}
            className="px-5 py-2.5 bg-[#87380F] hover:bg-[#6d2d0c] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors flex items-center"
          >
            Find
          </Link>
        </form>
      </div>
    </div>
  );
};
