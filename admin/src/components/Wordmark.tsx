import React from 'react';

/**
 * A plain wordmark, not the storefront seal.
 *
 * The full emblem is generated procedurally in the storefront's BrandLogo,
 * and pulling it in would couple two independently deployed apps for
 * decoration on a login screen.
 */
export const Wordmark: React.FC = () => (
  <div className="flex items-center gap-2.5">
    <span
      aria-hidden="true"
      className="w-9 h-9 rounded-lg bg-[#87380F] text-[#FAF6F0] grid place-items-center text-sm font-bold"
    >
      SV
    </span>
    <span className="text-sm font-semibold tracking-wide text-[#483828]">S V Admin</span>
  </div>
);
