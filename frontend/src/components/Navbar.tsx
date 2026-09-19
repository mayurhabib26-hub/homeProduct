import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo';
import { useShop } from '../context/ShopContext';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  ShoppingBag,
  Heart,
  Menu,
  X,
  ArrowRight,
  User,
} from 'lucide-react';

/** 'home' is the only nav id whose path is not just /<id>. */
const linkPath = (id: string) => (id === 'home' ? '/' : `/${id}`);

export const Navbar: React.FC = () => {
  const {
    cartItemCount,
    setIsCartDrawerOpen,
    setIsSearchOpen,
    wishlist,
  } = useShop();
  const { pathname } = useLocation();

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Home', id: 'home' },
    { label: 'Shop All', id: 'shop' },
    { label: 'Our Story', id: 'about' },
    { label: 'Recipes', id: 'recipes' },
    { label: 'Contact', id: 'contact' },
  ];

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#483828] text-[#F3E7D0] text-xs px-4 border-b border-[#B69A55]/20">
        <div className="max-w-7xl mx-auto flex justify-between items-center tracking-wider font-sans">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#B69A55] animate-pulse"></span>
            <span className="hidden sm:inline">Handcrafted South Indian Spices • Fresh Small Batches</span>
            <span className="sm:hidden">Authentic Homemade Spices</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden md:inline text-[#EBD9BC]">
              Free Shipping on Orders Above ₹499
            </span>
          </div>
        </div>
      </div>

      {/* Main Sticky Navbar */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          isScrolled
            ? 'bg-[#FAF6F0]/95 backdrop-blur-md shadow-sm border-b border-[#EBD9BC]/80 py-2.5'
            : 'bg-[#FAF6F0] py-4 border-b border-[#EBD9BC]/40'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Left: Mobile Menu Button & Desktop Logo */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                id="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-[#483828] hover:text-[#87380F] focus:outline-none"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>

              <Link to="/"
                id="brand-logo-btn"
                className="text-left focus:outline-none group cursor-pointer">
                <BrandLogo
                  size={isScrolled ? 'sm' : 'md'}
                  showText={true}
                  textColor="text-[#483828] group-hover:text-[#87380F] transition-colors"
                  subtextColor="text-[#87380F]"
                />
              </Link>
            </div>

            {/* Center: Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-8 xl:gap-10">
              {navLinks.map((link) => {
                const isActive = pathname === linkPath(link.id);
                return (
                  <Link
                    key={link.id}
                    id={`nav-${link.id}`}
                    to={linkPath(link.id)}
                    className={`inline-flex items-center min-h-11 text-sm font-sans font-medium tracking-wider uppercase transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#87380F] font-semibold'
                        : 'text-[#483828] hover:text-[#87380F]'
                    }`}
                  >
                    {/* The hit area is 44px; the underline stays tight to the
                        text rather than dropping to the bottom of the box. */}
                    <span className="relative py-1">
                      {link.label}
                      {isActive && (
                        <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#87380F] rounded-full transition-all duration-300" />
                      )}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions (Search, Wishlist, Cart) */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                type="button"
                id="navbar-search-btn"
                onClick={() => setIsSearchOpen(true)}
                className="grid place-items-center min-h-11 min-w-11 text-[#483828] hover:text-[#87380F] hover:bg-[#F3E7D0]/40 rounded-full transition-colors cursor-pointer"
                title="Search products & recipes"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              <Link
                to="/account"
                className="relative hidden sm:grid place-items-center min-h-11 min-w-11 text-[#483828] hover:text-[#87380F] hover:bg-[#F3E7D0]/40 rounded-full transition-colors cursor-pointer"
                aria-label="Your account">
                <User size={20} />
              </Link>
              <Link to="/shop"
                id="navbar-wishlist-btn"
                className="relative hidden sm:grid place-items-center min-h-11 min-w-11 text-[#483828] hover:text-[#87380F] hover:bg-[#F3E7D0]/40 rounded-full transition-colors cursor-pointer"
                title="Favorites"
                aria-label="Favorites">
                <Heart size={20} className={wishlist.length > 0 ? 'fill-[#87380F] text-[#87380F]' : ''} />
                {wishlist.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#87380F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </Link>

              <button
                type="button"
                id="navbar-cart-btn"
                onClick={() => setIsCartDrawerOpen(true)}
                className="relative min-h-11 min-w-11 bg-[#87380F] hover:bg-[#483828] text-[#F3E7D0] rounded-full transition-colors duration-200 cursor-pointer shadow-sm flex items-center justify-center"
                aria-label={`Cart with ${cartItemCount} items`}
              >
                <ShoppingBag size={19} />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#B69A55] text-[#2C2117] text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center border border-[#FAF6F0]">
                    {cartItemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#483828]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#FAF6F0] shadow-2xl flex flex-col justify-between border-r border-[#EBD9BC] p-6 z-50">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#EBD9BC]">
                <BrandLogo size="sm" showText={true} />
                <button
                  type="button"
                  id="close-mobile-menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-[#483828] hover:text-[#87380F] rounded-full"
                  aria-label="Close menu"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="py-6 space-y-3 font-sans">
                {navLinks.map((link) => (
                  <Link
                    key={link.id}
                    to={linkPath(link.id)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full text-left py-2.5 px-3 rounded-lg text-base font-medium flex items-center justify-between transition-colors ${
                      pathname === linkPath(link.id)
                        ? 'bg-[#EBD9BC]/60 text-[#87380F] font-semibold'
                        : 'text-[#483828] hover:bg-[#F3E7D0]/40'
                    }`}
                  >
                    <span>{link.label}</span>
                    <ArrowRight size={16} className="text-[#87380F]/60" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-t border-[#EBD9BC] pt-6 space-y-4">
              <p className="text-xs text-center text-[#483828]/70">
                Traditional South Indian flavours, crafted with love.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
