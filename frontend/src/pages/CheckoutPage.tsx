import React, { useState, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { CheckCircle2, ShieldCheck, ArrowRight, Phone, Truck, CreditCard, QrCode, Banknote } from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { Link, useNavigate } from 'react-router-dom';
import { whatsappUrl } from '../lib/contact';
import { api } from '../api/client';
import { openCheckout } from '../lib/razorpay';
import * as analytics from '../lib/analytics';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    cartTotal,
    shippingFee,
    appliedDiscount,
    couponCode,
    clearCart,
    generateWhatsAppOrderUrl,
    showToast,
  } = useShop();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    landmark: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [upiOption, setUpiOption] = useState<'gpay' | 'phonepe' | 'qr'>('gpay');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Never pre-ticked: consent bundled with a purchase is not consent.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const navigate = useNavigate();

  /**
   * One key per checkout attempt, not per request. A retry after a timeout
   * returns the original order instead of creating a second one — the server
   * enforces this with a unique index. See docs/API.md §1.
   */
  const idempotencyKey = useRef(crypto.randomUUID());

  const indianStates = [
    'Karnataka',
    'Tamil Nadu',
    'Kerala',
    'Andhra Pradesh',
    'Telangana',
    'Maharashtra',
    'Delhi NCR',
    'Gujarat',
    'Goa',
    'West Bengal',
    'Other States',
  ];

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.fullName || !formData.phone || !formData.address || !formData.pincode) {
      setSubmitError('Please fill in your name, phone, address and pincode.');
      return;
    }
    if (cart.length === 0) {
      setSubmitError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      // No prices in this request, by design. The server reads them from the
      // database — see docs/ARCHITECTURE.md §4.2.
      const order = await api.orders.create(
        {
          items: cart.map((i) => ({
            productSlug: i.productId,
            weight: i.selectedWeight,
            quantity: i.quantity,
          })),
          customer: {
            name: formData.fullName,
            phone: formData.phone,
            email: formData.email || undefined,
          },
          shipping: {
            address: formData.address,
            landmark: formData.landmark || undefined,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
          },
          couponCode: couponCode || undefined,
          paymentMethod,
          marketingConsent,
        },
        idempotencyKey.current,
      );

      if (order.payment === null) {
        // COD: accepted immediately, nothing to collect online.
        finishOrder(order.orderNumber);
        return;
      }

      await openCheckout({
        key: order.payment.keyId!,
        amount: order.payment.amountPaise,
        name: 'S V Home Products',
        description: `Order ${order.orderNumber}`,
        order_id: order.payment.razorpayOrderId!,
        prefill: { name: formData.fullName, contact: formData.phone, email: formData.email },
        theme: { color: '#87380F' },
        handler: async (response) => {
          try {
            // The signature is verified server-side before anything is marked
            // paid. This callback is attacker-controlled.
            await api.orders.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            finishOrder(order.orderNumber);
          } catch {
            // The webhook still settles this independently, so the money is
            // not lost — say so rather than implying failure.
            setSubmitting(false);
            setSubmitError(
              `We could not confirm payment for ${order.orderNumber} just now. If it was debited, it will be confirmed shortly — please keep this order number.`,
            );
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setSubmitError('Payment was cancelled. Your cart is still here.');
          },
        },
      });
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : 'We could not place your order. Please try again.');
    }
  };

  /**
   * Confirmation lives on /order/:orderNumber, not here. CheckoutPage used to
   * render its own success screen, which then competed with the real route
   * after navigating — the URL changed while the old screen stayed mounted.
   */
  const finishOrder = (number: string) => {
    /**
     * Before clearCart(), because the items are gone afterwards. The order
     * number is the only identifier sent — no name, phone or address ever
     * reaches Google. analytics.scrub() enforces that at the boundary.
     */
    analytics.purchase(
      number,
      cartTotal,
      cart.map((line) => ({
        slug: line.productId,
        name: line.product.name,
        weight: line.selectedWeight,
        pricePaise: line.pricePaise,
        quantity: line.quantity,
      })),
    );
    clearCart();
    setSubmitting(false);
    showToast('Order placed. Thank you!');
    navigate(`/order/${number}`, { replace: true, state: { justPlaced: true } });
  };


  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF6F0] min-h-[60vh] flex items-center justify-center py-16 px-4 font-sans">
        <div className="text-center max-w-md space-y-4">
          <h2 className="font-serif text-2xl font-bold text-[#483828]">No Items in Checkout</h2>
          <p className="text-xs text-[#483828]/70">Please add authentic spice blends to your cart first.</p>
          <Link to="/shop"
                className="px-6 py-2.5 bg-[#87380F] text-white text-xs font-semibold rounded uppercase tracking-wider">
            Visit Spice Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-10 md:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
            SPEEDY CHECKOUT
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828] mt-1">
            Shipping & Payment
          </h1>
        </div>

        <form onSubmit={handlePlaceOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left: Customer Information & Payment */}
            <div className="lg:col-span-7 space-y-8">
              {/* Shipping Address */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EBD9BC] shadow-xs space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#483828] border-b border-[#EBD9BC] pb-3 flex items-center gap-2">
                  <Truck size={20} className="text-[#87380F]" />
                  <span>1. Delivery Address (Pan-India)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#483828] mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Smt. Lakshmi Rao"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#483828] mb-1">
                      Phone Number (for Courier & WhatsApp) *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-[#483828] mb-1">
                    Email Address (for invoice)
                  </label>
                  <input
                    type="email"
                    placeholder="lakshmi@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                  />
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-[#483828] mb-1">
                    House / Flat No, Street Address *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="No. 42, 3rd Cross, Temple Road"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-semibold text-[#483828] mb-1">
                      Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Near Ganapathi Temple"
                      value={formData.landmark}
                      onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                      className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#483828] mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#483828] mb-1">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="560004"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-semibold text-[#483828] mb-1">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                  >
                    {indianStates.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EBD9BC] shadow-xs space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#483828] border-b border-[#EBD9BC] pb-3 flex items-center gap-2">
                  <CreditCard size={20} className="text-[#87380F]" />
                  <span>2. Payment Method</span>
                </h3>

                <div className="space-y-3">
                  {/* UPI Option */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      paymentMethod === 'upi'
                        ? 'border-[#87380F] bg-[#FAF6F0]'
                        : 'border-[#EBD9BC] hover:border-[#B69A55]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'upi'}
                      onChange={() => setPaymentMethod('upi')}
                      className="mt-1 text-[#87380F] focus:ring-[#87380F]"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-serif font-bold text-sm text-[#483828]">
                          Instant UPI (GPay / PhonePe / Paytm / QR)
                        </span>
                        <span className="text-[10px] font-bold text-[#647044] bg-[#647044]/10 px-2 py-0.5 rounded">
                          FASTEST
                        </span>
                      </div>
                      <p className="text-xs text-[#483828]/70 mt-0.5">
                        Zero transaction fees, immediate verification.
                      </p>

                      {paymentMethod === 'upi' && (
                        <div className="mt-3 pt-3 border-t border-[#EBD9BC] flex flex-wrap gap-2 text-xs">
                          {['gpay', 'phonepe', 'qr'].map((op) => (
                            <button
                              key={op}
                              type="button"
                              onClick={() => setUpiOption(op as any)}
                              className={`px-3 py-1.5 rounded border font-medium uppercase text-[11px] ${
                                upiOption === op
                                  ? 'border-[#87380F] bg-[#87380F] text-white'
                                  : 'border-[#EBD9BC] bg-white text-[#483828]'
                              }`}
                            >
                              {op === 'gpay' ? 'Google Pay' : op === 'phonepe' ? 'PhonePe' : 'UPI QR Scan'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Card / Net Banking */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      paymentMethod === 'card'
                        ? 'border-[#87380F] bg-[#FAF6F0]'
                        : 'border-[#EBD9BC] hover:border-[#B69A55]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="mt-1 text-[#87380F] focus:ring-[#87380F]"
                    />
                    <div className="flex-1">
                      <span className="font-serif font-bold text-sm text-[#483828]">
                        Debit / Credit Cards & Net Banking
                      </span>
                      <p className="text-xs text-[#483828]/70 mt-0.5">
                        Visa, Mastercard, RuPay, and all major Indian banks.
                      </p>
                    </div>
                  </label>

                  {/* Cash on Delivery */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      paymentMethod === 'cod'
                        ? 'border-[#87380F] bg-[#FAF6F0]'
                        : 'border-[#EBD9BC] hover:border-[#B69A55]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-1 text-[#87380F] focus:ring-[#87380F]"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-serif font-bold text-sm text-[#483828]">
                          Cash on Delivery (COD)
                        </span>
                        <span className="text-[10px] text-[#483828]/60">Available Pan-India</span>
                      </div>
                      <p className="text-xs text-[#483828]/70 mt-0.5">
                        Pay cash or UPI at your doorstep upon package arrival.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Order Review & Placement */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-[#EBD9BC] shadow-xs space-y-4">
                <h3 className="font-serif text-xl font-bold text-[#483828] border-b border-[#EBD9BC] pb-3">
                  Order Summary
                </h3>

                {/* Items preview */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1 text-xs divide-y divide-[#EBD9BC]/50">
                  {cart.map((item) => (
                    <div key={item.id} className="pt-2 flex justify-between items-center">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-10 h-10 rounded object-cover border border-[#EBD9BC]"
                        />
                        <div>
                          <span className="font-medium text-[#483828] block line-clamp-1">
                            {item.product.name}
                          </span>
                          <span className="text-[10px] text-[#87380F]">
                            {item.selectedWeight} × {item.quantity}
                          </span>
                        </div>
                      </div>
                      <span className="font-serif font-bold text-[#87380F]">
                        {formatPaise(item.pricePaise * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Cost breakdown */}
                <div className="pt-3 border-t border-[#EBD9BC] space-y-2 text-xs text-[#483828]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPaise(cartSubtotal)}</span>
                  </div>
                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-[#647044] font-medium">
                      <span>Coupon ({couponCode})</span>
                      <span>-{formatPaise(appliedDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Pan-India Delivery</span>
                    <span>{shippingFee === 0 ? <span className="text-[#647044] font-bold">FREE</span> : formatPaise(shippingFee)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-serif font-bold text-[#87380F] pt-2 border-t border-[#EBD9BC]">
                    <span>Total Amount Payable</span>
                    <span>{formatPaise(cartTotal)}</span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  id="place-order-button"
                  disabled={submitting || cart.length === 0}
                  className="w-full py-3.5 bg-[#87380F] hover:bg-[#662707] disabled:bg-[#87380F]/50 disabled:cursor-not-allowed text-white rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      <span>PLACING YOUR ORDER…</span>
                    </>
                  ) : (
                    <>
                      <span>{paymentMethod === 'cod' ? 'CONFIRM COD ORDER' : 'PAY & PLACE ORDER'}</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* The label carries the 44px target; the checkbox itself is 16px. */}
                <label className="flex items-start gap-2.5 mt-4 mb-1 py-2 min-h-11 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 shrink-0 w-4 h-4 accent-[#87380F]"
                  />
                  <span className="text-[11px] text-[#483828]/75 leading-relaxed">
                    Send me occasional offers and new product news on WhatsApp.
                    Order updates are sent either way — this is only for
                    promotions, and you can stop them any time.
                  </span>
                </label>

                {submitError && (
                  <div
                    role="alert"
                    className="mt-3 p-3 rounded-md bg-[#87380F]/8 border border-[#87380F]/25 text-xs text-[#87380F] leading-relaxed"
                  >
                    {submitError}
                    <a
                      href={generateWhatsAppOrderUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-2 font-semibold underline"
                    >
                      Or place this order on WhatsApp instead
                    </a>
                  </div>
                )}

                <div className="text-center pt-1">
                  <a
                    href={generateWhatsAppOrderUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#647044] hover:underline font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Phone size={13} />
                    <span>Prefer ordering via WhatsApp? Tap here</span>
                  </a>
                </div>

                <div className="pt-3 border-t border-[#EBD9BC] text-center text-[11px] text-[#483828]/70 flex items-center justify-center gap-1.5">
                  <ShieldCheck size={14} className="text-[#647044]" />
                  <span>Freshly roasted in small batches • 100% Authentic Guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
