import React, { useState } from 'react';
import { motion } from 'motion/react';
import {Product, formatPaise } from '@sv/shared';
import { useShop } from '../context/ShopContext';
import { Star, Heart, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, className = '' }) => {
  const { addToCart, toggleWishlist, isWishlisted } = useShop();
  const [selectedWeight, setSelectedWeight] = useState(product.variants[0]?.weight || '100g');

  const currentVariant =
    product.variants.find((v) => v.weight === selectedWeight) || product.variants[0];

  const wishlisted = isWishlisted(product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`group bg-[#FAF6F0] rounded-xl overflow-hidden border border-[#EBD9BC] hover:border-[#B69A55]/60 transition-all duration-300 hover:shadow-md flex flex-col justify-between ${className}`}
    >
      {/* Product Image Area */}
      <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-[#F3E7D0]/40">
        <Link to={`/product/${product.id}`} className="block w-full h-full" tabIndex={-1} aria-hidden="true">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </Link>

        {/* Badge */}
        {product.badge && (
          <span className="absolute top-3 left-3 bg-[#87380F] text-[#FAF6F0] text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase px-2.5 py-1 rounded-sm shadow-xs">
            {product.badge}
          </span>
        )}

        {/* Wishlist Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#FAF6F0]/90 backdrop-blur-xs text-[#483828] hover:text-[#87380F] flex items-center justify-center transition-colors shadow-xs cursor-pointer"
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart
            size={16}
            className={wishlisted ? 'fill-[#87380F] text-[#87380F]' : 'stroke-[1.8]'}
          />
        </button>

        {/* Category Pill */}
        <div className="absolute bottom-3 left-3 opacity-90">
          <span className="text-[10px] font-sans tracking-wide uppercase bg-[#FAF6F0]/90 text-[#647044] font-medium px-2 py-0.5 rounded-xs">
            {product.categoryLabel}
          </span>
        </div>
      </div>

      {/* Product Info Area */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="flex items-center text-[#B69A55]">
              <Star size={13} className="fill-[#B69A55]" />
            </div>
            <span className="text-xs font-semibold text-[#483828]">{product.rating}</span>
            <span className="text-[11px] text-[#483828]/60">({product.reviewsCount})</span>
          </div>

          {/* Title */}
          <h3 className="font-serif text-lg sm:text-xl font-bold leading-tight line-clamp-1">
            <Link
              to={`/product/${product.id}`}
              className="text-[#483828] hover:text-[#87380F] transition-colors"
            >
              {product.name}
            </Link>
          </h3>

          {product.regionalName && (
            <p className="text-[11px] font-serif text-[#B69A55] font-medium mt-0.5">
              {product.regionalName}
            </p>
          )}

          {/* Short Description */}
          <p className="text-xs text-[#483828]/75 line-clamp-2 mt-2 leading-relaxed font-sans">
            {product.shortDescription}
          </p>
        </div>

        <div className="pt-4 mt-2 border-t border-[#EBD9BC]/60">
          {/* Weight Selection Chips */}
          <div className="flex items-center gap-1.5 mb-3 flex-wrap">
            <span className="text-[10px] uppercase font-sans font-semibold tracking-wider text-[#483828]/60 mr-1">
              Pack:
            </span>
            {product.variants.map((v) => (
              <button
                key={v.weight}
                type="button"
                onClick={() => setSelectedWeight(v.weight)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-sm border transition-all cursor-pointer ${
                  selectedWeight === v.weight
                    ? 'border-[#87380F] bg-[#87380F] text-white font-semibold'
                    : 'border-[#EBD9BC] bg-[#F7EFE1] text-[#483828] hover:border-[#B69A55]'
                }`}
              >
                {v.weight}
              </button>
            ))}
          </div>

          {/* Price & Action */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-serif text-xl sm:text-2xl font-bold text-[#87380F]">
                  {formatPaise(currentVariant.pricePaise)}
                </span>
                {currentVariant.mrpPaise && (
                  <span className="text-xs line-through text-[#483828]/50">
                    {formatPaise(currentVariant.mrpPaise)}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#647044] font-medium">Incl. all taxes</span>
            </div>

            <button
              type="button"
              id={`add-to-cart-${product.id}`}
              onClick={() => addToCart(product, selectedWeight, 1)}
              className="px-3.5 py-2 bg-[#87380F] hover:bg-[#483828] text-[#FAF6F0] rounded-md text-xs font-semibold tracking-wider uppercase transition-colors duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <ShoppingBag size={14} />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
