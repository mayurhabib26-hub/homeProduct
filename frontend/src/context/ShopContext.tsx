import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { type ProductSummary, CartItem, StoredCartItem, rupees, percentOf, formatPaise } from '@sv/shared';
import { useProducts } from '../api/queries';
import { api } from '../api/client';
import { whatsappUrl } from '../lib/contact';
import * as analytics from '../lib/analytics';

interface ShopContextType {
  cart: CartItem[];
  wishlist: string[]; // product IDs
  isCartDrawerOpen: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  couponCode: string;
  appliedDiscount: number;
  toastMessage: string | null;
  addToCart: (product: ProductSummary, selectedWeight: string, quantity?: number) => void;
  updateCartQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  setIsSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string }>;
  isApplyingCoupon: boolean;
  removeCoupon: () => void;
  showToast: (msg: string) => void;
  cartSubtotal: number;
  cartTotal: number;
  shippingFee: number;
  freeShippingThresholdPaise: number;
  cartItemCount: number;
  generateWhatsAppOrderUrl: (product?: ProductSummary, weight?: string, qty?: number) => string;
}

// Shipping rules. Server-side once orders move to the API — see docs/API.md.
const FREE_SHIPPING_THRESHOLD_PAISE = rupees(499);
const SHIPPING_FEE_PAISE = rupees(60);

const CART_KEY = 'sv_cart_v2';
const LEGACY_CART_KEY = 'sv_cart';

/**
 * v1 carts embedded the whole product object, including its price at the time
 * of adding. Keep the line, discard the snapshot — the catalogue is the only
 * source of price now. Unreadable entries are dropped rather than guessed at.
 */
function migrateLegacyCart(): StoredCartItem[] {
  try {
    const legacy = localStorage.getItem(LEGACY_CART_KEY);
    if (!legacy) return [];
    const rows: Array<Record<string, unknown>> = JSON.parse(legacy);
    const migrated = rows.flatMap((row) => {
      const productId = typeof row.productId === 'string' ? row.productId : null;
      const selectedWeight = typeof row.selectedWeight === 'string' ? row.selectedWeight : null;
      const quantity = typeof row.quantity === 'number' ? row.quantity : 1;
      if (!productId || !selectedWeight) return [];
      return [{ productId, selectedWeight, quantity }];
    });
    localStorage.removeItem(LEGACY_CART_KEY);
    return migrated;
  } catch {
    return [];
  }
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Only identifiers are stored. See StoredCartItem.
  const [storedCart, setStoredCart] = useState<StoredCartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      // Annotated, not inferred: JSON.parse returns any, which would let a
      // malformed stored cart through the type system untouched.
      const parsed: StoredCartItem[] | null = saved ? JSON.parse(saved) : null;
      if (parsed) return parsed;
      return migrateLegacyCart();
    } catch {
      return [];
    }
  });

  /**
   * Resolve the stored cart against the catalogue on every render.
   *
   * Lines whose product or weight no longer exists are dropped rather than
   * shown at a stale price — a discontinued item should disappear, not
   * quietly sell at last year's price.
   */
  // The catalogue comes from the API; react-query caches it, so this does not
  // refetch on every cart change.
  const { data: catalogue } = useProducts({ limit: 60 });

  const cart: CartItem[] = useMemo(
    () =>
      storedCart.flatMap((line) => {
        const product = (catalogue?.data ?? []).find((p) => p.slug === line.productId);
        const variant = product?.variants.find((v) => v.weight === line.selectedWeight);
        if (!product || !variant) return [];
        return [{
          ...line,
          id: `${line.productId}-${line.selectedWeight}`,
          product,
          pricePaise: variant.pricePaise,
        }];
      }),
    [storedCart, catalogue],
  );

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
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(storedCart));
    } catch (e) {
      console.error(e);
    }
  }, [storedCart]);

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

  const addToCart = (product: ProductSummary, selectedWeight: string, quantity = 1) => {
    const weight = product.variants.some((v) => v.weight === selectedWeight)
      ? selectedWeight
      : product.variants[0].weight;

    // Fires only with consent and a measurement id; a no-op otherwise.
    const variant = product.variants.find((v) => v.weight === weight);
    if (variant) {
      analytics.addToCart({
        slug: product.slug, name: product.name, weight,
        pricePaise: variant.pricePaise, quantity,
      });
    }

    setStoredCart((prev) => {
      const existing = prev.find(
        (line) => line.productId === product.slug && line.selectedWeight === weight,
      );
      if (existing) {
        return prev.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + quantity } : line,
        );
      }
      return [...prev, { productId: product.slug, selectedWeight: weight, quantity }];
    });

    showToast(`Added ${product.name} (${selectedWeight}) to cart`);
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setStoredCart((prev) =>
      prev.map((line) =>
        `${line.productId}-${line.selectedWeight}` === itemId ? { ...line, quantity } : line,
      ),
    );
  };

  const removeFromCart = (itemId: string) => {
    setStoredCart((prev) =>
      prev.filter((line) => `${line.productId}-${line.selectedWeight}` !== itemId),
    );
    showToast('Item removed from cart');
  };

  const clearCart = () => {
    setStoredCart([]);
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

  /**
   * Validated by the server. The codes used to be hardcoded here, which meant
   * anyone could read them in the bundle and edit the discount in devtools.
   * This only previews — the order transaction re-validates and decides.
   */
  const applyCoupon = async (code: string) => {
    if (cart.length === 0) {
      return { success: false, message: 'Add something to your cart first.' };
    }

    setIsApplyingCoupon(true);
    try {
      const result = await api.coupons.validate(
        code,
        cart.map((i) => ({
          productSlug: i.productId,
          weight: i.selectedWeight,
          quantity: i.quantity,
        })),
      );
      setAppliedDiscount(result.discountPaise);
      setCouponCode(result.code);
      showToast(`Coupon applied — ${formatPaise(result.discountPaise)} off`);
      return { success: true, message: `${formatPaise(result.discountPaise)} discount applied.` };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That coupon could not be applied.';
      return { success: false, message };
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedDiscount(0);
    setCouponCode('');
    showToast('Coupon removed');
  };

  const generateWhatsAppOrderUrl = (product?: ProductSummary, weight?: string, qty = 1) => {
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

    return whatsappUrl(messageText);
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
        isApplyingCoupon,
        removeCoupon,
        showToast,
        cartSubtotal,
        cartTotal,
        shippingFee,
        freeShippingThresholdPaise: FREE_SHIPPING_THRESHOLD_PAISE,
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
