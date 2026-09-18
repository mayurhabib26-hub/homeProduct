import React, { createContext, useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Product, CartItem, rupees, percentOf, formatPaise } from '@sv/shared';

interface ShopContextType {
  cart: CartItem[];
  wishlist: string[]; // product IDs
  isCartDrawerOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  couponCode: string;
  appliedDiscount: number;
  toastMessage: string | null;
  addToCart: (product: Product, selectedWeight: string, quantity?: number) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  setIsSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  showToast: (msg: string) => void;
  cartSubtotal: number;
  cartTotal: number;
  shippingFee: number;
  cartItemCount: number;
  generateWhatsAppOrderUrl: (product?: Product, weight?: string, qty?: number) => string;
}

// Shipping rules. Server-side once orders move to the API — see docs/API.md.
const FREE_SHIPPING_THRESHOLD_PAISE = rupees(499);
const SHIPPING_FEE_PAISE = rupees(60);

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('sv_cart');
      // Annotated, not inferred: JSON.parse returns any, which would let a
      // stale or malformed stored cart through the type system untouched.
      const parsed: CartItem[] | null = saved ? JSON.parse(saved) : null;
      return parsed ?? [];
    } catch {
      return [];
    }
  });

  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('sv_wishlist');
      const parsed: string[] | null = saved ? JSON.parse(saved) : null;
      return parsed ?? [];
    } catch {
      return [];
    }
  });

  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sv_cart', JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart]);

  // Sync wishlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sv_wishlist', JSON.stringify(wishlist));
    } catch (e) {
      console.error(e);
    }
  }, [wishlist]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const addToCart = (product: Product, selectedWeight: string, quantity = 1) => {
    const variant = product.variants.find((v) => v.weight === selectedWeight) || product.variants[0];
    const itemId = `${product.id}-${selectedWeight}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === itemId);
      if (existing) {
        return prev.map((item) =>
          item.id === itemId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [
        ...prev,
        {
          id: itemId,
          productId: product.id,
          product,
          selectedWeight,
          pricePaise: variant.pricePaise,
          quantity,
        },
      ];
    });

    showToast(`Added ${product.name} (${selectedWeight}) to cart`);
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => {
      if (prev.includes(productId)) {
        showToast('Removed from your favorites');
        return prev.filter((id) => id !== productId);
      } else {
        showToast('Saved to your favorites');
        return [...prev, productId];
      }
    });
  };

  const isWishlisted = (productId: string) => wishlist.includes(productId);

  const cartSubtotal = cart.reduce((acc, item) => acc + item.pricePaise * item.quantity, 0);
  const shippingFee =
    cartSubtotal >= FREE_SHIPPING_THRESHOLD_PAISE || cartSubtotal === 0 ? 0 : SHIPPING_FEE_PAISE;
  const cartTotal = Math.max(0, cartSubtotal - appliedDiscount + shippingFee);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const applyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === 'SVTRADITION' || clean === 'WELCOME10') {
      const discount = percentOf(cartSubtotal, 10);
      setAppliedDiscount(discount);
      setCouponCode(clean);
      showToast('Coupon applied! 10% discount added.');
      return { success: true, message: '10% discount applied successfully!' };
    }
    if (clean === 'TASTEOFHOME') {
      const discount = rupees(50);
      setAppliedDiscount(discount);
      setCouponCode(clean);
      showToast(`Coupon applied! ${formatPaise(discount)} flat discount.`);
      return { success: true, message: `${formatPaise(discount)} flat discount applied!` };
    }
    return { success: false, message: 'Invalid coupon code. Try SVTRADITION for 10% off.' };
  };

  const removeCoupon = () => {
    setAppliedDiscount(0);
    setCouponCode('');
    showToast('Coupon removed');
  };

  const generateWhatsAppOrderUrl = (product?: Product, weight?: string, qty = 1) => {
    const phoneNumber = '919876543210'; // Client's WhatsApp support number placeholder
    let messageText = '';

    if (product) {
      const variant = product.variants.find((v) => v.weight === weight) || product.variants[0];
      messageText = `Namaste S V Home Products!\nI would like to order:\n- Product: ${product.name}\n- Weight: ${weight || variant.weight}\n- Quantity: ${qty}\n- Price: ${formatPaise(variant.pricePaise * qty)}\n\nPlease confirm availability and delivery details.`;
    } else if (cart.length > 0) {
      const itemsList = cart
        .map((item) => `• ${item.product.name} (${item.selectedWeight}) x ${item.quantity} = ${formatPaise(item.pricePaise * item.quantity)}`)
        .join('\n');
      messageText = `Namaste S V Home Products!\nI would like to place an order for my cart items:\n\n${itemsList}\n\nSubtotal: ${formatPaise(cartSubtotal)}\nShipping: ${shippingFee === 0 ? 'FREE' : formatPaise(shippingFee)}\nTotal: ${formatPaise(cartTotal)}\n\nPlease share payment details and dispatch timeline.`;
    } else {
      messageText = 'Namaste S V Home Products! I would like to enquire about your authentic homemade spice powders and traditional South Indian food products.';
    }

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageText)}`;
  };

  return (
    <ShopContext.Provider
      value={{
        cart,
        wishlist,
        isCartDrawerOpen,
        isSearchOpen,
        searchQuery,
        couponCode,
        appliedDiscount,
        toastMessage,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        toggleWishlist,
        isWishlisted,
        setIsCartDrawerOpen,
        setIsSearchOpen,
        setSearchQuery,
        applyCoupon,
        removeCoupon,
        showToast,
        cartSubtotal,
        cartTotal,
        shippingFee,
        cartItemCount,
        generateWhatsAppOrderUrl,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
