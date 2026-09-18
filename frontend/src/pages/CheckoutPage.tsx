import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { CheckCircle2, ShieldCheck, ArrowRight, Phone, Truck, CreditCard, QrCode, Banknote } from 'lucide-react';
import { formatPaise } from '@sv/shared';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    cartTotal,
    shippingFee,
    appliedDiscount,
    couponCode,
    clearCart,
    setActivePage,
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
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

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

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.address || !formData.pincode) {
      showToast('Please fill all mandatory shipping details');
      return;
    }

    const generatedId = `SV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    setOrderNumber(generatedId);
    setOrderPlaced(true);
    clearCart();
    showToast('Order placed successfully! Thank you.');
  };

  if (orderPlaced) {
    return (
      <div className="bg-[#FAF6F0] min-h-screen py-12 md:py-20 font-sans">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white p-8 sm:p-12 rounded-2xl border border-[#EBD9BC] shadow-md text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#647044]/15 text-[#647044] flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                ORDER CONFIRMED
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828] mt-1">
                Thank You, {formData.fullName}!
              </h1>
              <p className="text-sm text-[#483828]/80 mt-2 font-sans">
                Your order <strong className="text-[#87380F] font-mono">{orderNumber}</strong> has been received by our family kitchen and is being freshly prepared for dispatch.
              </p>
            </div>

            <div className="bg-[#FAF6F0] p-5 rounded-xl border border-[#EBD9BC] text-left text-xs text-[#483828] space-y-2">
              <div className="flex justify-between border-b border-[#EBD9BC] pb-2 font-semibold">
                <span>Shipping Address:</span>
                <span className="text-[#87380F]">{formData.city}, {formData.state}</span>
              </div>
              <p className="text-[#483828]/80 leading-relaxed pt-1">
                {formData.address}, {formData.landmark ? `Near ${formData.landmark}, ` : ''}{formData.city} - {formData.pincode}
              </p>
              <p className="text-[#483828]/70">
                Phone: {formData.phone} | Payment Method: <span className="uppercase font-semibold">{paymentMethod}</span>
              </p>
              <div className="pt-2 border-t border-[#EBD9BC] flex justify-between font-bold text-sm text-[#87380F]">
                <span>Total Amount Paid/Due:</span>
                <span>{formatPaise(cartTotal)}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href={`https://wa.me/919876543210?text=Namaste%20S%20V%20Home%20Products!%20I%20just%20placed%20order%20${orderNumber}.%20Please%20confirm%20dispatch.`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-[#647044] hover:bg-[#4d5733] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
              >
                <Phone size={15} />
                <span>CONFIRM & TRACK ON WHATSAPP</span>
              </a>

              <button
                type="button"
                onClick={() => setActivePage('home')}
                className="w-full py-3 bg-[#FAF6F0] hover:bg-[#EBD9BC] text-[#483828] border border-[#EBD9BC] rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
              >
                RETURN TO HOMEPAGE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF6F0] min-h-[60vh] flex items-center justify-center py-16 px-4 font-sans">
        <div className="text-center max-w-md space-y-4">
          <h2 className="font-serif text-2xl font-bold text-[#483828]">No Items in Checkout</h2>
          <p className="text-xs text-[#483828]/70">Please add authentic spice blends to your cart first.</p>
          <button
            onClick={() => setActivePage('shop')}
            className="px-6 py-2.5 bg-[#87380F] text-white text-xs font-semibold rounded uppercase tracking-wider"
          >
            Visit Spice Shop
          </button>
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
                    <span>{shippingFee === 0 ? <span className="text-[#647044] font-bold">FREE</span> : `₹${shippingFee}`}</span>
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
                  className="w-full py-3.5 bg-[#87380F] hover:bg-[#662707] text-white rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>PLACE ORDER NOW</span>
                  <ArrowRight size={16} />
                </button>

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
