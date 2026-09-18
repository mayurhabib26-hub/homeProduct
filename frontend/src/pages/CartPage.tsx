import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Tag, Phone } from 'lucide-react';

export const CartPage: React.FC = () => {
  const {
    cart,
    updateCartQuantity,
    removeFromCart,
    cartSubtotal,
    cartTotal,
    shippingFee,
    appliedDiscount,
    couponCode,
    applyCoupon,
    removeCoupon,
    setActivePage,
    generateWhatsAppOrderUrl,
  } = useShop();

  const [inputCoupon, setInputCoupon] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);

  const freeShippingThreshold = 499;
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - cartSubtotal);
  const freeShippingPercent = Math.min(100, (cartSubtotal / freeShippingThreshold) * 100);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    if (!inputCoupon.trim()) return;
    const res = applyCoupon(inputCoupon);
    if (!res.success) {
      setCouponError(res.message);
    } else {
      setInputCoupon('');
    }
  };

  if (cart.length === 0) {
    return (
      <div className="bg-[#FAF6F0] min-h-[70vh] flex items-center justify-center py-16 px-4 font-sans">
        <div className="text-center max-w-md mx-auto space-y-4 bg-white p-8 sm:p-12 rounded-2xl border border-[#EBD9BC] shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#EBD9BC]/50 text-[#87380F] flex items-center justify-center mx-auto">
            <ShoppingBag size={32} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#483828]">Your Cart is Empty</h1>
          <p className="text-xs sm:text-sm text-[#483828]/75 leading-relaxed">
            Your spice pantry is waiting. Explore our authentic homemade Rasam, Puliyogare, and Sambar powders to begin.
          </p>
          <button
            type="button"
            id="empty-cart-explore-btn"
            onClick={() => setActivePage('shop')}
            className="mt-4 px-8 py-3 bg-[#87380F] hover:bg-[#662707] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors inline-block cursor-pointer"
          >
            START SHOPPING
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
            REVIEW YOUR ORDER
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828] mt-1">
            Shopping Cart ({cart.reduce((tot, it) => tot + it.quantity, 0)} Items)
          </h1>
        </div>

        {/* Free Shipping Alert */}
        <div className="bg-[#F7EFE1] p-4 rounded-xl border border-[#EBD9BC] mb-8">
          {remainingForFreeShipping > 0 ? (
            <p className="text-xs sm:text-sm text-[#483828] font-medium">
              Add <strong className="text-[#87380F]">₹{remainingForFreeShipping}</strong> more to your cart to get <strong className="text-[#647044]">FREE Pan-India Delivery!</strong>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#647044] font-bold">
              🎉 Congratulations! You have unlocked FREE Delivery across India!
            </p>
          )}
          <div className="w-full bg-[#EBD9BC] h-2 rounded-full mt-2.5 overflow-hidden">
            <div
              className="bg-[#87380F] h-full rounded-full transition-all duration-500"
              style={{ width: `${freeShippingPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Cart Items Table / List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-[#EBD9BC] overflow-hidden shadow-xs divide-y divide-[#EBD9BC]">
              {cart.map((item) => (
                <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                  <div className="flex gap-4 items-center">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl bg-[#FAF6F0] border border-[#EBD9BC] shrink-0"
                    />
                    <div>
                      <h3 className="font-serif text-lg font-bold text-[#483828] leading-tight">
                        {item.product.name}
                      </h3>
                      <span className="text-xs text-[#87380F] font-semibold block mt-0.5">
                        Pack: {item.selectedWeight}
                      </span>
                      <span className="text-xs text-[#483828]/60 block font-serif">
                        ₹{item.price} each
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EBD9BC]/50">
                    {/* Stepper */}
                    <div className="flex items-center border border-[#EBD9BC] rounded-lg bg-[#FAF6F0]">
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                        className="px-2.5 py-1.5 text-[#483828] hover:text-[#87380F]"
                        aria-label="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="px-3 text-xs font-bold text-[#483828]">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                        className="px-2.5 py-1.5 text-[#483828] hover:text-[#87380F]"
                        aria-label="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Price */}
                    <div className="text-right min-w-[70px]">
                      <span className="font-serif text-lg font-bold text-[#87380F]">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-[#483828]/50 hover:text-red-700 transition-colors p-1"
                      aria-label="Remove item"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setActivePage('shop')}
              className="text-xs font-semibold uppercase tracking-wider text-[#87380F] hover:underline flex items-center gap-1.5 pt-2"
            >
              <span>← Continue Shopping for Spices</span>
            </button>
          </div>

          {/* Right Summary Card */}
          <div className="lg:col-span-4">
            <div className="bg-white p-6 rounded-2xl border border-[#EBD9BC] shadow-xs space-y-6">
              <h2 className="font-serif text-xl font-bold text-[#483828] border-b border-[#EBD9BC] pb-3">
                Order Summary
              </h2>

              {/* Coupon */}
              <div>
                {couponCode ? (
                  <div className="flex items-center justify-between bg-[#647044]/15 border border-[#647044]/30 rounded-lg px-3 py-2.5 text-xs">
                    <span className="text-[#647044] font-semibold flex items-center gap-1.5">
                      <Tag size={14} /> Coupon {couponCode} (-₹{appliedDiscount})
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-red-700 font-semibold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coupon (e.g. SVTRADITION)"
                      value={inputCoupon}
                      onChange={(e) => setInputCoupon(e.target.value)}
                      className="flex-1 bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3 py-2 text-xs uppercase tracking-wider text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#483828] hover:bg-[#87380F] text-white text-xs font-semibold rounded-md transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponError && <p className="text-[11px] text-red-700 mt-1">{couponError}</p>}
                <p className="text-[10px] text-[#483828]/60 mt-1.5">
                  Try coupon code <span className="font-bold text-[#87380F]">SVTRADITION</span> for 10% off!
                </p>
              </div>

              {/* Price Details */}
              <div className="space-y-2.5 text-xs text-[#483828] pt-2 border-t border-[#EBD9BC]/70">
                <div className="flex justify-between">
                  <span>Cart Subtotal</span>
                  <span className="font-semibold">₹{cartSubtotal}</span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-[#647044] font-medium">
                    <span>Special Discount</span>
                    <span>-₹{appliedDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Delivery Charges</span>
                  <span>{shippingFee === 0 ? <span className="text-[#647044] font-semibold">FREE</span> : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-lg font-serif font-bold text-[#87380F] pt-3 border-t border-[#EBD9BC]">
                  <span>Total Amount</span>
                  <span>₹{cartTotal}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  id="cart-proceed-checkout"
                  onClick={() => setActivePage('checkout')}
                  className="w-full py-3.5 bg-[#87380F] hover:bg-[#662707] text-white rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>PROCEED TO CHECKOUT</span>
                  <ArrowRight size={16} />
                </button>

                <a
                  href={generateWhatsAppOrderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 bg-transparent border border-[#87380F] text-[#87380F] hover:bg-[#87380F]/10 rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
                >
                  <Phone size={14} />
                  <span>ORDER DIRECTLY VIA WHATSAPP</span>
                </a>
              </div>

              <div className="pt-2 text-center text-[11px] text-[#483828]/70 flex items-center justify-center gap-1.5">
                <ShieldCheck size={14} className="text-[#647044]" />
                <span>100% Genuine Ingredients • Secure Payment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
