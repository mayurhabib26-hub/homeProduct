import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ShieldCheck, Tag, Phone } from 'lucide-react';
import { formatPaise } from '@sv/shared';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
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

  if (!isCartDrawerOpen) return null;

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

  const handleProceedToCheckout = () => {
    setIsCartDrawerOpen(false);
    setActivePage('checkout');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#483828]/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={() => setIsCartDrawerOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#FAF6F0] shadow-2xl flex flex-col border-l border-[#EBD9BC]">
          {/* Header */}
          <div className="p-5 border-b border-[#EBD9BC] flex items-center justify-between bg-[#F7EFE1]/80">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="text-[#87380F]" size={20} />
              <h2 className="font-serif text-xl font-bold text-[#483828]">Your Spice Pantry</h2>
              <span className="text-xs bg-[#87380F] text-[#FAF6F0] px-2 py-0.5 rounded-full font-semibold">
                {cart.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </div>
            <button
              type="button"
              id="close-cart-drawer"
              onClick={() => setIsCartDrawerOpen(false)}
              className="p-1.5 text-[#483828] hover:text-[#87380F] rounded-full transition-colors"
              aria-label="Close cart"
            >
              <X size={20} />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="bg-[#EBD9BC]/40 px-5 py-3 border-b border-[#EBD9BC]">
            {remainingForFreeShipping > 0 ? (
              <p className="text-xs text-[#483828] font-medium">
                Add <span className="font-bold text-[#87380F]">{formatPaise(remainingForFreeShipping)}</span> more
                for <span className="text-[#647044] font-semibold">FREE Pan-India Delivery!</span>
              </p>
            ) : (
              <p className="text-xs text-[#647044] font-semibold flex items-center gap-1.5">
                <span>🎉</span> You’ve unlocked FREE Delivery across India!
              </p>
            )}
            <div className="w-full bg-[#EBD9BC] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#87380F] h-full rounded-full transition-all duration-500"
                style={{ width: `${freeShippingPercent}%` }}
              />
            </div>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#EBD9BC]/50 text-[#87380F] flex items-center justify-center mx-auto">
                  <ShoppingBag size={28} />
                </div>
                <h3 className="font-serif text-xl font-bold text-[#483828]">Your Cart is Empty</h3>
                <p className="text-sm text-[#483828]/70 max-w-xs mx-auto">
                  Discover our traditional South Indian spice blends prepared with love and heritage recipes.
                </p>
                <button
                  type="button"
                  id="empty-cart-shop-now"
                  onClick={() => {
                    setIsCartDrawerOpen(false);
                    setActivePage('shop');
                  }}
                  className="mt-4 px-6 py-2.5 bg-[#87380F] hover:bg-[#483828] text-white rounded-md text-sm font-semibold tracking-wider uppercase transition-colors inline-block"
                >
                  Explore Products
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-3 bg-white rounded-lg border border-[#EBD9BC] shadow-xs"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="w-20 h-20 object-cover rounded-md bg-[#F3E7D0]/30 shrink-0"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-serif text-base font-bold text-[#483828] leading-tight line-clamp-1">
                          {item.product.name}
                        </h4>
                        <span className="text-xs text-[#87380F] font-medium block mt-0.5">
                          Pack: {item.selectedWeight}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-[#483828]/50 hover:text-red-700 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-[#EBD9BC] rounded bg-[#FAF6F0]">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-[#483828] hover:text-[#87380F] transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="px-2.5 text-xs font-semibold text-[#483828]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-[#483828] hover:text-[#87380F] transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Price */}
                      <div className="text-right">
                        <span className="font-serif text-base font-bold text-[#87380F]">
                          {formatPaise(item.pricePaise * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Summary & Checkout */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-[#EBD9BC] bg-[#F7EFE1] space-y-4">
              {/* Coupon code input */}
              <div>
                {couponCode ? (
                  <div className="flex items-center justify-between bg-[#647044]/15 border border-[#647044]/30 rounded-md px-3 py-2 text-xs">
                    <span className="text-[#647044] font-semibold flex items-center gap-1.5">
                      <Tag size={13} /> {couponCode} Applied (-{formatPaise(appliedDiscount)})
                    </span>
                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-red-700 hover:underline font-medium"
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
                      className="flex-1 bg-white border border-[#EBD9BC] rounded px-3 py-1.5 text-xs uppercase tracking-wider text-[#483828] focus:outline-none focus:border-[#87380F]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#483828] hover:bg-[#87380F] text-white text-xs font-semibold rounded transition-colors"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponError && <p className="text-[11px] text-red-700 mt-1">{couponError}</p>}
              </div>

              {/* Cost breakdown */}
              <div className="space-y-1.5 text-xs text-[#483828]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatPaise(cartSubtotal)}</span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex justify-between text-[#647044] font-medium">
                    <span>Discount</span>
                    <span>-{formatPaise(appliedDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span>{shippingFee === 0 ? <span className="text-[#647044] font-semibold">FREE</span> : `₹${shippingFee}`}</span>
                </div>
                <div className="flex justify-between text-base font-serif font-bold text-[#87380F] pt-2 border-t border-[#EBD9BC]">
                  <span>Total Amount</span>
                  <span>{formatPaise(cartTotal)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  id="checkout-proceed-btn"
                  onClick={handleProceedToCheckout}
                  className="w-full py-3 bg-[#87380F] hover:bg-[#662707] text-white rounded-md font-sans text-sm font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={16} />
                </button>

                <a
                  href={generateWhatsAppOrderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-transparent border border-[#87380F] text-[#87380F] hover:bg-[#87380F]/10 rounded-md font-sans text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                >
                  <Phone size={14} />
                  <span>Order Directly on WhatsApp</span>
                </a>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-[#483828]/70 pt-1">
                <ShieldCheck size={14} className="text-[#647044]" />
                <span>100% Secure Checkout • Authentic Quality Guaranteed</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
