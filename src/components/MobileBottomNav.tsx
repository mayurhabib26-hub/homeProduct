import React from 'react';
import { useShop } from '../context/ShopContext';
import { Home, ShoppingBag, Search, Compass, BookOpen } from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const {
    activePage,
    setActivePage,
    cartItemCount,
    setIsCartDrawerOpen,
    setIsSearchOpen,
  } = useShop();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAF6F0]/95 backdrop-blur-md border-t border-[#EBD9BC] px-3 py-2 flex items-center justify-around shadow-md font-sans">
      <button
        type="button"
        onClick={() => setActivePage('home')}
        className={`flex flex-col items-center gap-1 p-1 transition-colors ${
          activePage === 'home' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
        }`}
      >
        <Home size={19} />
        <span className="text-[10px] tracking-wider uppercase">Home</span>
      </button>

      <button
        type="button"
        onClick={() => setActivePage('shop')}
        className={`flex flex-col items-center gap-1 p-1 transition-colors ${
          activePage === 'shop' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
        }`}
      >
        <Compass size={19} />
        <span className="text-[10px] tracking-wider uppercase">Shop</span>
      </button>

      <button
        type="button"
        onClick={() => setIsSearchOpen(true)}
        className="flex flex-col items-center gap-1 p-1 text-[#483828]/70 hover:text-[#87380F] transition-colors"
      >
        <Search size={19} />
        <span className="text-[10px] tracking-wider uppercase">Search</span>
      </button>

      <button
        type="button"
        onClick={() => setActivePage('recipes')}
        className={`flex flex-col items-center gap-1 p-1 transition-colors ${
          activePage === 'recipes' ? 'text-[#87380F] font-semibold' : 'text-[#483828]/70 hover:text-[#87380F]'
        }`}
      >
        <BookOpen size={19} />
        <span className="text-[10px] tracking-wider uppercase">Recipes</span>
      </button>

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
