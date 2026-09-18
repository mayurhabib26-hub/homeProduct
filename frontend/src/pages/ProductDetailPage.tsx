import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { PRODUCTS } from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { ScrollReveal } from '../components/ScrollReveal';
import {
  Star,
  ShoppingBag,
  Heart,
  Phone,
  ArrowRight,
  ShieldCheck,
  Truck,
  Leaf,
  Plus,
  Minus,
  Check,
  Share2,
} from 'lucide-react';

export const ProductDetailPage: React.FC = () => {
  const {
    selectedProductId,
    addToCart,
    toggleWishlist,
    isWishlisted,
    setActivePage,
    generateWhatsAppOrderUrl,
    showToast,
  } = useShop();

  const product = PRODUCTS.find((p) => p.id === selectedProductId) || PRODUCTS[0];
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [selectedWeight, setSelectedWeight] = useState(product.variants[0]?.weight || '100g');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'about' | 'ingredients' | 'howToUse' | 'storage' | 'nutrition' | 'shipping' | 'reviews'>('about');

  // Update selected image if product changed
  React.useEffect(() => {
    setSelectedImage(product.image);
    setSelectedWeight(product.variants[0]?.weight || '100g');
    setQuantity(1);
  }, [product]);

  const currentVariant =
    product.variants.find((v) => v.weight === selectedWeight) || product.variants[0];

  const wishlisted = isWishlisted(product.id);

  // Recommendations: exclude current product
  const recommendedProducts = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 4);

  const handleBuyNow = () => {
    addToCart(product, selectedWeight, quantity);
    setActivePage('checkout');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Authentic South Indian ${product.name} from S V Home Products`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      showToast('Product link copied to clipboard!');
    }
  };

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-8 md:py-14 font-sans pb-24 lg:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-[#483828]/70 mb-6 sm:mb-8 font-sans">
          <button onClick={() => setActivePage('home')} className="hover:text-[#87380F]">
            Home
          </button>
          <span>/</span>
          <button onClick={() => setActivePage('shop')} className="hover:text-[#87380F]">
            Shop All
          </button>
          <span>/</span>
          <span className="text-[#87380F] font-semibold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Main Product Presentation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 mb-16">
          {/* Left: Product Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            {/* Primary Large Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white border border-[#EBD9BC] shadow-sm group">
              <img
                src={selectedImage}
                alt={product.name}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
              />

              {product.badge && (
                <span className="absolute top-4 left-4 bg-[#87380F] text-[#FAF6F0] text-xs font-sans font-semibold tracking-wider uppercase px-3 py-1 rounded-sm shadow-xs">
                  {product.badge}
                </span>
              )}

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#FAF6F0]/90 text-[#483828] hover:text-[#87380F] flex items-center justify-center transition-colors shadow-xs"
                aria-label="Wishlist"
              >
                <Heart
                  size={20}
                  className={wishlisted ? 'fill-[#87380F] text-[#87380F]' : ''}
                />
              </button>
            </div>

            {/* Thumbnail Gallery */}
            {product.gallery && product.gallery.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {product.gallery.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImage(imgUrl)}
                    className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      selectedImage === imgUrl
                        ? 'border-[#87380F] ring-2 ring-[#87380F]/20'
                        : 'border-[#EBD9BC] hover:border-[#B69A55] opacity-75'
                    }`}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details & Purchase Options */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-sans uppercase tracking-widest font-semibold text-[#647044] bg-[#647044]/10 px-2.5 py-0.5 rounded-sm">
                  {product.categoryLabel}
                </span>
                <button
                  onClick={handleShare}
                  className="text-xs text-[#483828]/60 hover:text-[#87380F] flex items-center gap-1"
                >
                  <Share2 size={14} />
                  <span>Share</span>
                </button>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828] leading-tight">
                {product.name}
              </h1>

              {product.regionalName && (
                <p className="text-base font-serif text-[#B69A55] font-semibold mt-1">
                  {product.regionalName}
                </p>
              )}

              {/* Rating */}
              <div className="flex items-center gap-2 mt-3">
                <div className="flex text-[#B69A55]">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={15}
                      className={i < Math.floor(product.rating) ? 'fill-[#B69A55]' : 'fill-none'}
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-[#483828]">{product.rating}</span>
                <span className="text-xs text-[#483828]/60">({product.reviewsCount} customer reviews)</span>
              </div>
            </div>

            {/* Price section */}
            <div className="p-4 bg-[#F7EFE1] rounded-xl border border-[#EBD9BC]">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-3xl sm:text-4xl font-bold text-[#87380F]">
                  ₹{currentVariant.price * quantity}
                </span>
                {currentVariant.originalPrice && (
                  <span className="text-base line-through text-[#483828]/50">
                    ₹{currentVariant.originalPrice * quantity}
                  </span>
                )}
                {currentVariant.originalPrice && (
                  <span className="text-xs font-semibold text-[#647044] bg-[#647044]/10 px-2 py-0.5 rounded">
                    Save ₹{(currentVariant.originalPrice - currentVariant.price) * quantity}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#483828]/70 mt-1">
                Inclusive of all taxes. Free delivery on orders over ₹499.
              </p>
            </div>

            {/* Short Tagline */}
            <p className="text-sm text-[#483828]/85 leading-relaxed font-sans">
              {product.shortDescription}
            </p>

            {/* Pack Size / Weight Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#483828]">
                Select Quantity Pack: <span className="text-[#87380F]">{selectedWeight}</span>
              </label>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((v) => (
                  <button
                    key={v.weight}
                    type="button"
                    onClick={() => setSelectedWeight(v.weight)}
                    className={`px-4 py-2.5 rounded-lg border text-xs font-semibold tracking-wider uppercase transition-all ${
                      selectedWeight === v.weight
                        ? 'border-[#87380F] bg-[#87380F] text-white shadow-xs'
                        : 'border-[#EBD9BC] bg-white text-[#483828] hover:border-[#B69A55]'
                    }`}
                  >
                    {v.weight} — ₹{v.price}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity Stepper */}
            <div className="flex items-center gap-4 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#483828]">
                Quantity:
              </span>
              <div className="flex items-center border border-[#EBD9BC] rounded-lg bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-[#483828] hover:text-[#87380F]"
                  aria-label="Decrease"
                >
                  <Minus size={14} />
                </button>
                <span className="px-4 text-sm font-bold text-[#483828]">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-3 py-2 text-[#483828] hover:text-[#87380F]"
                  aria-label="Increase"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* CTAs */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  id="pdp-add-to-cart"
                  onClick={() => addToCart(product, selectedWeight, quantity)}
                  className="w-full py-3.5 bg-[#87380F] hover:bg-[#662707] text-[#FAF6F0] rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <ShoppingBag size={16} />
                  <span>ADD TO CART</span>
                </button>

                <button
                  type="button"
                  id="pdp-buy-now"
                  onClick={handleBuyNow}
                  className="w-full py-3.5 bg-[#483828] hover:bg-[#2C2117] text-[#FAF6F0] rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>BUY NOW</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {/* Order via WhatsApp Button with pre-filled message */}
              <a
                href={generateWhatsAppOrderUrl(product, selectedWeight, quantity)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-[#647044] hover:bg-[#4d5733] text-white rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Phone size={15} />
                <span>ORDER ON WHATSAPP (PRE-FILLED)</span>
              </a>
            </div>

            {/* Trust highlights */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[#EBD9BC] text-center">
              <div className="p-2">
                <Leaf size={18} className="text-[#647044] mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-[#483828] block">100% Pure</span>
                <span className="text-[9px] text-[#483828]/60">No preservatives</span>
              </div>
              <div className="p-2">
                <Truck size={18} className="text-[#87380F] mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-[#483828] block">Pan-India</span>
                <span className="text-[9px] text-[#483828]/60">Fast Dispatch</span>
              </div>
              <div className="p-2">
                <ShieldCheck size={18} className="text-[#B69A55] mx-auto mb-1" />
                <span className="text-[10px] font-semibold text-[#483828] block">Family Kitchen</span>
                <span className="text-[9px] text-[#483828]/60">Fresh Small Batch</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed In-Depth Information Section */}
        <ScrollReveal animation="fade-up">
          <div className="bg-white rounded-2xl border border-[#EBD9BC] overflow-hidden shadow-sm mb-16">
          {/* Tabs bar */}
          <div className="flex border-b border-[#EBD9BC] overflow-x-auto bg-[#F7EFE1]/60">
            {[
              { id: 'about', label: 'About This Product' },
              { id: 'ingredients', label: 'Ingredients' },
              { id: 'howToUse', label: 'How to Use' },
              { id: 'storage', label: 'Storage' },
              { id: 'nutrition', label: 'Nutrition' },
              { id: 'shipping', label: 'Shipping & Delivery' },
              { id: 'reviews', label: `Reviews (${product.reviewsCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3.5 text-xs font-sans tracking-wider uppercase font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#87380F] text-[#87380F] bg-white'
                    : 'border-transparent text-[#483828]/70 hover:text-[#87380F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="p-6 sm:p-8 font-sans">
            {activeTab === 'about' && (
              <div className="space-y-4 max-w-3xl">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  The Story of {product.name}
                </h3>
                <p className="text-sm text-[#483828]/85 leading-relaxed">
                  {product.about}
                </p>
                <div className="bg-[#F7EFE1] p-4 rounded-lg border border-[#EBD9BC] flex items-center gap-3 mt-4">
                  <div className="w-10 h-10 rounded-full bg-[#87380F] text-white flex items-center justify-center font-bold text-sm">
                    SV
                  </div>
                  <div>
                    <h5 className="font-serif text-sm font-bold text-[#483828]">Heirloom Standard</h5>
                    <p className="text-xs text-[#483828]/75">
                      Slow-roasted on traditional iron kadai to retain aromatic essential oils and natural flavors.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ingredients' && (
              <div className="max-w-3xl space-y-4">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Pure Ingredients, Nothing Else
                </h3>
                <p className="text-xs text-[#483828]/75">
                  We use zero artificial colors, synthetic aromatics, MSG, or palm oil.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {product.ingredients.map((ing, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-3 bg-[#FAF6F0] rounded-lg border border-[#EBD9BC]"
                    >
                      <Check size={16} className="text-[#87380F] shrink-0" />
                      <span className="text-xs font-semibold text-[#483828]">{ing}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'howToUse' && (
              <div className="max-w-3xl space-y-4">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Traditional Preparation Method
                </h3>
                <ol className="space-y-3 pt-2">
                  {product.howToUse.map((step, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 text-xs sm:text-sm text-[#483828]/85 leading-relaxed"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#87380F] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {activeTab === 'storage' && (
              <div className="max-w-3xl space-y-3">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Storage & Shelf Life
                </h3>
                <p className="text-xs sm:text-sm text-[#483828]/85 leading-relaxed">
                  {product.storage}
                </p>
                <div className="p-4 bg-[#FAF6F0] border border-[#EBD9BC] rounded-lg text-xs text-[#483828]/80 space-y-1">
                  <p>• Best consumed within 6-9 months from manufacturing date.</p>
                  <p>• Always use a dry stainless steel spoon.</p>
                  <p>• Transfer to an airtight glass or tin jar after opening the pouch.</p>
                </div>
              </div>
            )}

            {activeTab === 'nutrition' && (
              <div className="max-w-xl space-y-4">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Nutrition Facts
                </h3>
                <p className="text-xs text-[#483828]/70">
                  Serving Size: {product.nutrition.servingSize}
                </p>
                <div className="border border-[#EBD9BC] rounded-lg overflow-hidden text-xs divide-y divide-[#EBD9BC]">
                  <div className="flex justify-between p-3 bg-[#F7EFE1] font-semibold">
                    <span>Energy</span>
                    <span>{product.nutrition.energy}</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span>Protein</span>
                    <span>{product.nutrition.protein}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-[#FAF6F0]">
                    <span>Carbohydrates</span>
                    <span>{product.nutrition.carbohydrates}</span>
                  </div>
                  <div className="flex justify-between p-3">
                    <span>Fat</span>
                    <span>{product.nutrition.fat}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="max-w-3xl space-y-4 text-xs sm:text-sm text-[#483828]/85 leading-relaxed">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Pan-India Delivery
                </h3>
                <p>
                  Orders are dispatched directly from our kitchen within 24-48 hours of freshly roasting and milling.
                </p>
                <ul className="space-y-2 list-disc pl-5">
                  <li>Standard Metro Deliveries (Bengaluru, Chennai, Hyderabad): 2-3 working days.</li>
                  <li>Rest of India: 4-6 working days via tracked courier services.</li>
                  <li>FREE Pan-India Shipping on all orders above ₹499. Flat ₹60 for smaller orders.</li>
                </ul>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="max-w-3xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-2xl font-bold text-[#483828]">
                    Customer Impressions
                  </h3>
                  <div className="flex items-center gap-1 text-[#B69A55] font-bold text-sm">
                    <Star size={16} className="fill-[#B69A55]" />
                    <span>{product.rating} out of 5</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#EBD9BC]">
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className="font-sans text-xs font-bold text-[#483828]">Vasantha R.</h4>
                      <span className="text-[10px] text-[#483828]/50">3 weeks ago</span>
                    </div>
                    <div className="flex text-[#B69A55] mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className="fill-[#B69A55]" />
                      ))}
                    </div>
                    <p className="text-xs text-[#483828]/80 leading-relaxed font-serif italic">
                      “Authentic home taste. The aroma when I open the packet is so fresh, completely different from packaged supermarket powders.”
                    </p>
                  </div>

                  <div className="p-4 bg-[#FAF6F0] rounded-xl border border-[#EBD9BC]">
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className="font-sans text-xs font-bold text-[#483828]">Raghavendra K.</h4>
                      <span className="text-[10px] text-[#483828]/50">1 month ago</span>
                    </div>
                    <div className="flex text-[#B69A55] mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={12} className="fill-[#B69A55]" />
                      ))}
                    </div>
                    <p className="text-xs text-[#483828]/80 leading-relaxed font-serif italic">
                      “Prepared this for my parents visiting from hometown. They immediately commented on the authentic spice balance. Will keep re-ordering!”
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </ScrollReveal>

        {/* You May Also Like (Recommended Products) */}
        <ScrollReveal animation="fade-up">
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                TRADITIONAL PAIRINGS
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#483828] mt-1">
                You May Also Like
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {recommendedProducts.map((rec) => (
                <ProductCard key={rec.id} product={rec} />
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Sticky Mobile Add to Cart Bar */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-20 bg-[#FAF6F0] border-t border-[#EBD9BC] p-3 shadow-lg flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] text-[#483828]/70 block">{selectedWeight}</span>
          <span className="font-serif text-lg font-bold text-[#87380F]">
            ₹{currentVariant.price * quantity}
          </span>
        </div>
        <button
          type="button"
          onClick={() => addToCart(product, selectedWeight, quantity)}
          className="flex-1 py-2.5 bg-[#87380F] hover:bg-[#662707] text-white rounded-md text-xs font-semibold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 shadow-sm"
        >
          <ShoppingBag size={14} />
          <span>Add to Cart</span>
        </button>
      </div>
    </div>
  );
};
