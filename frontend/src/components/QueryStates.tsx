import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Loading, empty and error states.
 *
 * With a hardcoded array data was always instantly present; over a network it
 * is not. A page that renders nothing while fetching looks broken and gets
 * refreshed. Every fetching surface uses these.
 */

export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-[#EBD9BC] bg-white overflow-hidden animate-pulse">
    <div className="aspect-[4/3] sm:aspect-square bg-[#F3E7D0]/60" />
    <div className="p-4 space-y-3">
      <div className="h-3 w-20 bg-[#F3E7D0] rounded" />
      <div className="h-5 w-3/4 bg-[#F3E7D0] rounded" />
      <div className="h-3 w-full bg-[#F3E7D0] rounded" />
      <div className="h-9 w-full bg-[#F3E7D0] rounded mt-4" />
    </div>
  </div>
);

export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div
    className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6"
    role="status"
    aria-label="Loading products"
  >
    {Array.from({ length: count }, (_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div role="alert" className="text-center py-16 px-4">
    <h2 className="font-serif text-2xl font-bold text-[#483828]">Something went wrong</h2>
    <p className="text-sm text-[#483828]/75 mt-2 max-w-md mx-auto">
      {message ?? 'We could not load this right now.'}
    </p>
    <div className="mt-6 flex items-center justify-center gap-3">
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 bg-[#87380F] hover:bg-[#6d2d0c] text-white rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
        >
          Try again
        </button>
      )}
      <Link
        to="/"
        className="px-6 py-3 border border-[#EBD9BC] hover:bg-[#F3E7D0]/40 text-[#483828] rounded-md text-xs font-bold tracking-widest uppercase transition-colors"
      >
        Go home
      </Link>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="text-center py-16 px-4">
    <h2 className="font-serif text-2xl font-bold text-[#483828]">{title}</h2>
    {hint && <p className="text-sm text-[#483828]/75 mt-2 max-w-md mx-auto">{hint}</p>}
  </div>
);
