import React from 'react';
import { useShop } from '../context/ShopContext';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Search, Compass, BookOpen } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const {
    cartItemCount,
    setIsCartDrawerOpen,
    setIsSearchOpen,
  } = useShop();
  const { pathname } = useLocation();

  // paddingBottom below keeps this clear of the iPhone home indicator when
  // the PWA runs standalone. Pairs with viewport-fit=cover in index.html —
  // without both, the nav renders under the indicator.
  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-t border-[#EBD9BC] px-3 pt-2 flex items-center justify-around shadow-md font-sans"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <Link to="/"
                className={`flex flex-col items-center gap-1 p-1 transition-colors ${
                pathname === '/' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
                }`}>
        <Home size={19} />
        <span className="text-[10px] tracking-wider uppercase">Home</span>
      </Link>

      <Link to="/shop"
                className={`flex flex-col items-center gap-1 p-1 transition-colors ${
                pathname === '/shop' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
                }`}>
        <Compass size={19} />
        <span className="text-[10px] tracking-wider uppercase">Shop</span>
      </Link>

      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        className="flex flex-col items-center gap-1 p-1 text-[#483828]/70 hover:text-[#87380F] transition-colors"
      >
        <Search size={19} />
        <span className="text-[10px] tracking-wider uppercase">Search</span>
      </button>

      <Link to="/recipes"
                className={`flex flex-col items-center gap-1 p-1 transition-colors ${
                pathname === '/recipes' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
                }`}>
        <BookOpen size={19} />
        <span className="text-[10px] tracking-wider uppercase">Recipes</span>
      </Link>

      <button
        type="button"
        onClick={() => setIsCartDrawerOpen(true)}
        className="relative flex flex-col items-center gap-1 p-1 text-[#483828]/70 hover:text-[#87380F] transition-colors"
      >
        <div className="relative">
          <ShoppingBag size={19} />
          {cartItemCount > 0 && (
            <span className="absolute -top-1.5 -right-2 bg-[#87380F] text-white text-[9px] font-bold px-1 rounded-full min-w-[15px] text-center">
              {cartItemCount}
            </span>
          )}
        </div>
        <span className="text-[10px] tracking-wider uppercase">Cart</span>
      </button>
    </div>
  );
};
