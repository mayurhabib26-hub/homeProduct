/**
 * The HTTP contract between frontend and backend.
 *
 * These mirror docs/API.md. The backend shapes responses to match and the
 * frontend consumes them, so a change here is a change to both sides —
 * deliberately, so the contract cannot drift silently.
 *
 * Products are identified by `slug` here, never by a database id. Internal
 * keys never appear in a URL or a payload. See docs/DATABASE.md §1.
 */

export interface ApiVariant {
  id: number;
  weight: string;
  pricePaise: number;
  mrpPaise?: number;
  inStock: boolean;
  /** Derived server-side from a threshold — exact counts are never exposed. */
  lowStock: boolean;
}

export interface ProductSummary {
  slug: string;
  name: string;
  regionalName?: string;
  shortDescription: string;
  category: string;
  categoryLabel: string;
  badge?: string;
  image: string;
  rating: number;
  reviewsCount: number;
  featured: boolean;
  isSignature: boolean;
  variants: ApiVariant[];
}

export interface ApiReview {
  id: number;
  name: string;
  location?: string;
  rating: number;
  comment: string;
  verified: boolean;
  date: string;
}

export interface ProductDetail extends ProductSummary {
  about: string;
  ingredients: string[];
  howToUse: string[];
  storage: string;
  nutrition: {
    servingSize: string;
    energy: string;
    protein: string;
    carbohydrates: string;
    fat: string;
  };
  spiceLevel: string;
  gallery: string[];
  reviews: ApiReview[];
  related: ProductSummary[];
}

export interface ApiRecipe {
  slug: string;
  title: string;
  subtitle: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  image: string;
  description: string;
  pairedProductSlug?: string;
  ingredients: string[];
  instructions: string[];
  chefTip: string;
}

export interface HydratedCartLine {
  productSlug: string;
  name: string;
  image: string;
  weight: string;
  pricePaise: number;
  quantity: number;
  linePaise: number;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

/* --- orders ------------------------------------------------------------ */

export interface OrderLineRequest {
  productSlug: string;
  weight: string;
  quantity: number;
}

export interface CreateOrderRequest {
  items: OrderLineRequest[];
  customer: { name: string; phone: string; email?: string };
  shipping: {
    address: string; landmark?: string; city: string; state: string; pincode: string;
  };
  couponCode?: string;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'cod';
  notes?: string;
}

export interface OrderTotals {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
}

export interface CreatedOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalPaise: number;
  breakdown: OrderTotals;
  /** null for COD — nothing to collect online. */
  payment: { provider: 'razorpay'; keyId?: string; razorpayOrderId?: string; amountPaise: number } | null;
}

export interface TrackedOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  placedAt: string;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  courier?: string | null;
  shippingCity: string;
  shippingState: string;
  totals: OrderTotals & { totalPaise: number };
  items: {
    name: string; weight: string; quantity: number;
    unitPricePaise: number; lineTotalPaise: number;
  }[];
}
