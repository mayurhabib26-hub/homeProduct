import React, { useState, useMemo } from 'react';
import { PRODUCTS } from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { ScrollReveal } from '../components/ScrollReveal';

export const ShopPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'bestselling' | 'price-asc' | 'price-desc' | 'rating'>('bestselling');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under-150' | '150-300' | 'above-300'>('all');

  const categories = [
    { id: 'all', label: 'All Products' },
    { id: 'classics', label: 'South Indian Classics' },
    { id: 'spices', label: 'Spice Powders' },
    { id: 'chutney_podi', label: 'Chutney & Podi' },
    { id: 'combos', label: 'Combo Collections' },
  ];

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product) => {
      // Category filter
      if (selectedCategory !== 'all' && product.category !== selectedCategory) {
        return false;
      }
      // Search term filter
      if (
        searchTerm &&
        !product.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !product.shortDescription.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !product.ingredients.some((ing) => ing.toLowerCase().includes(searchTerm.toLowerCase()))
      ) {
        return false;
      }
      // Price filter (based on lowest variant price)
      const lowestPrice = product.variants[0]?.price || 0;
      if (priceFilter === 'under-150' && lowestPrice >= 150) return false;
      if (priceFilter === '150-300' && (lowestPrice < 150 || lowestPrice > 300)) return false;
      if (priceFilter === 'above-300' && lowestPrice <= 300) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-asc') {
        return a.variants[0].price - b.variants[0].price;
      }
      if (sortBy === 'price-desc') {
        return b.variants[0].price - a.variants[0].price;
      }
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      // 'bestselling'
      return b.reviewsCount - a.reviewsCount;
    });
  }, [selectedCategory, searchTerm, sortBy, priceFilter]);

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-10 md:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
              OUR COMPLETE PANTRY
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
              SHOP ALL
            </h1>
            <p className="text-sm sm:text-base text-[#483828]/80 leading-relaxed font-sans">
              Explore our collection of authentic homemade spice blends and traditional favourites.
              Stone-ground, naturally sun-dried, and roasted with love.
            </p>
          </div>
        </ScrollReveal>

        {/* Filter & Search Toolbar */}
        <ScrollReveal animation="fade-up" delay={0.05}>
          <div className="bg-[#F7EFE1] p-4 sm:p-5 rounded-xl border border-[#EBD9BC] mb-8 space-y-4 shadow-2xs">
            {/* Top Row: Search and Sort */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              {/* Search Input */}
              <div className="relative w-full md:w-80">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#483828]/50"
                />
                <input
                  type="text"
                  placeholder="Search rasam, sambar, podi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white rounded-md border border-[#EBD9BC] text-xs text-[#483828] placeholder-[#483828]/50 focus:outline-none focus:border-[#87380F]"
                />
              </div>

              {/* Price Filter & Sort Selection */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="flex items-center gap-1.5 text-xs text-[#483828]">
                  <SlidersHorizontal size={14} className="text-[#87380F]" />
                  <span className="font-medium hidden sm:inline">Price:</span>
                  <select
                    value={priceFilter}
                    onChange={(e) => setPriceFilter(e.target.value as any)}
                    className="bg-white border border-[#EBD9BC] rounded px-2.5 py-1.5 text-xs text-[#483828] focus:outline-none focus:border-[#87380F]"
                  >
                    <option value="all">All Prices</option>
                    <option value="under-150">Under ₹150</option>
                    <option value="150-300">₹150 - ₹300</option>
                    <option value="above-300">Above ₹300</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#483828]">
                  <ArrowUpDown size={14} className="text-[#87380F]" />
                  <span className="font-medium hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-white border border-[#EBD9BC] rounded px-2.5 py-1.5 text-xs text-[#483828] focus:outline-none focus:border-[#87380F]"
                  >
                    <option value="bestselling">Best Selling</option>
                    <option value="rating">Highest Rated</option>
                    <option value="price-asc">Price: Low to High</option>
                    <option value="price-desc">Price: High to Low</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1 border-t border-[#EBD9BC]/60">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-xs px-4 py-1.5 rounded-full whitespace-nowrap transition-all font-medium cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#87380F] text-white shadow-xs'
                      : 'bg-white border border-[#EBD9BC] text-[#483828] hover:border-[#87380F]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Results Counter */}
        <div className="flex justify-between items-center mb-6 text-xs text-[#483828]/70">
          <span>
            Showing <strong className="text-[#483828] font-bold">{filteredProducts.length}</strong> authentic products
          </span>
          {(searchTerm || selectedCategory !== 'all' || priceFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setPriceFilter('all');
              }}
              className="text-[#87380F] font-semibold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Products Grid: 4 cols desktop, 2 cols tablet, 2 cols mobile */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-[#EBD9BC] p-8">
            <h3 className="font-serif text-2xl font-bold text-[#483828] mb-2">
              No matching spice powders found
            </h3>
            <p className="text-xs sm:text-sm text-[#483828]/70 max-w-sm mx-auto mb-6">
              Try adjusting your search keyword or clearing the filters to discover our traditional blends.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setPriceFilter('all');
              }}
              className="px-6 py-2.5 bg-[#87380F] text-white text-xs font-semibold rounded uppercase tracking-wider cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product, idx) => (
              <ScrollReveal key={product.id} animation="fade-up" delay={Math.min(idx * 0.05, 0.25)}>
                <ProductCard product={product} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
