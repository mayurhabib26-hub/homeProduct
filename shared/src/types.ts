// Types shared by frontend and backend.
//
// All money is integer paise. Never a float, never a decimal string.
// Format for display with formatPaise() from ./money — never by hand.

export interface ProductVariant {
  weight: string;
  pricePaise: number;
  mrpPaise?: number;
  inStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  regionalName?: string;
  shortDescription: string;
  category: 'classics' | 'spices' | 'chutney_podi' | 'combos';
  categoryLabel: string;
  badge?: 'Bestseller' | 'Traditional Favorite' | 'Handcrafted' | 'New' | 'Festival Special' | 'Heritage Recipe';
  variants: ProductVariant[];
  rating: number;
  reviewsCount: number;
  image: string;
  gallery: string[];
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
  spiceLevel: 'Mild' | 'Medium' | 'Medium-Spicy' | 'Rich & Aromatic';
  featured?: boolean;
  isSignature?: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  selectedWeight: string;
  pricePaise: number;
  quantity: number;
}

export interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: 'Easy' | 'Moderate' | 'Traditional';
  image: string;
  description: string;
  pairedProductId?: string;
  pairedProductName?: string;
  ingredients: string[];
  instructions: string[];
  chefTip: string;
}

export interface CustomerReview {
  id: string;
  name: string;
  location: string;
  rating: number;
  date: string;
  comment: string;
  productPurchased: string;
  verified: boolean;
}

export interface CheckoutFormData {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: 'upi' | 'card' | 'netbanking' | 'cod';
  orderNotes?: string;
}
