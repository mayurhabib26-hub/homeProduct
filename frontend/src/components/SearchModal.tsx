import React from 'react';
import { useShop } from '../context/ShopContext';
import { useProducts, useRecipes } from '../api/queries';
import { Search, X, ArrowRight, Sparkles } from 'lucide-react';
import { formatPaise } from '@sv/shared';
import { Link, useNavigate } from 'react-router-dom';

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
  } = useShop();
  const { data: catalogue } = useProducts({ search: searchQuery.trim() || undefined, limit: 60 });
  const { data: recipeList } = useRecipes();
  const allProducts = catalogue?.data ?? [];
  const allRecipes = recipeList ?? [];
  const navigate = useNavigate();

  if (!isSearchOpen) return null;

  const query = searchQuery.toLowerCase().trim();

  // Product search runs server-side: it covers ingredients, which the
  // summary payload deliberately omits.
  const matchedProducts = query ? allProducts : allProducts.slice(0, 4);

  const matchedRecipes = query
    ? allRecipes.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query) ||
          r.ingredients.some((i) => i.toLowerCase().includes(query))
      )
    : allRecipes.slice(0, 3);

  const quickKeywords = ['Rasam', 'Puliyogare', 'Sambar', 'Gunpowder', 'Curry Leaves', 'Byadagi'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto font-sans p-4 sm:p-6 md:p-20">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#483828]/70 backdrop-blur-xs transition-opacity"
        onClick={() => setIsSearchOpen(false)}
      />

      <div className="relative max-w-2xl mx-auto bg-[#FAF6F0] rounded-xl shadow-2xl border border-[#EBD9BC] overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 border-b border-[#EBD9BC] flex items-center gap-3 bg-[#F7EFE1]">
          <Search size={22} className="text-[#87380F] shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search spice blends, powders, recipes (e.g. Rasam, Puliyogare)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-base text-[#483828] placeholder-[#483828]/50 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-[#483828]/60 hover:text-[#87380F]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            id="close-search-modal"
            onClick={() => setIsSearchOpen(false)}
            className="p-1.5 text-[#483828] hover:text-[#87380F] rounded-full transition-colors ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-3 bg-[#F3E7D0]/50 border-b border-[#EBD9BC] flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[#483828]/70 font-medium shrink-0 flex items-center gap-1">
            <Sparkles size={12} className="text-[#B69A55]" /> Popular:
          </span>
          {quickKeywords.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => setSearchQuery(kw)}
              className="px-2.5 py-1 rounded-full bg-white border border-[#EBD9BC] hover:border-[#87380F] hover:text-[#87380F] text-[#483828] whitespace-nowrap transition-colors"
            >
              {kw}
            </button>
          ))}
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-6">
          {/* Products Section */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-serif text-base font-bold text-[#483828]">
                {query ? `Spice Products (${matchedProducts.length})` : 'Popular Spice Powders'}
              </h4>
              {matchedProducts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(false);
                    navigate('/shop');
                  }}
                  className="text-xs text-[#87380F] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>View in shop</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>

            {matchedProducts.length === 0 ? (
              <p className="text-xs text-[#483828]/60 italic py-2">No matching products found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchedProducts.map((p) => (
                  <Link
                    key={p.slug}
                    to={`/product/${p.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-[#EBD9BC] hover:border-[#87380F] cursor-pointer transition-all hover:shadow-xs group"
                  >
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-14 h-14 rounded object-cover shrink-0 bg-[#FAF6F0]"
                    />
                    <div className="flex-1 min-w-0">
                      <h5 className="font-serif text-sm font-bold text-[#483828] group-hover:text-[#87380F] truncate">
                        {p.name}
                      </h5>
                      <p className="text-[11px] text-[#483828]/70 truncate">
                        {p.shortDescription}
                      </p>
                      <span className="text-xs font-bold text-[#87380F] font-serif">
                        From {formatPaise(p.variants[0].pricePaise)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recipes Section */}
          <div>
            <h4 className="font-serif text-base font-bold text-[#483828] mb-3">
              {query ? `Matching Kitchen Recipes (${matchedRecipes.length})` : 'Heritage Recipes'}
            </h4>
            {matchedRecipes.length === 0 ? (
              <p className="text-xs text-[#483828]/60 italic py-2">No matching recipes found.</p>
            ) : (
              <div className="space-y-2">
                {matchedRecipes.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/recipes/${r.slug}`}
                    onClick={() => setIsSearchOpen(false)}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-[#EBD9BC] hover:border-[#87380F] cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={r.image}
                        alt={r.title}
                        className="w-12 h-12 rounded object-cover shrink-0"
                      />
                      <div>
                        <h5 className="font-serif text-sm font-bold text-[#483828] group-hover:text-[#87380F]">
                          {r.title}
                        </h5>
                        <p className="text-[11px] text-[#483828]/70">
                          {r.prepTime} prep • {r.difficulty}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-[#87380F] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
