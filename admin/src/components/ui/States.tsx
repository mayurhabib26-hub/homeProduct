import React from 'react';
import { PackageOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Loading, empty and error states.
 *
 * A screen that renders nothing while fetching looks broken and gets
 * refreshed. Skeletons mirror the real layout so the page does not jump when
 * data lands.
 */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 8, cols = 6 }) => (
  <div role="status" aria-label="Loading" className="p-4 space-y-3">
    <div className="flex gap-3">
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className="skeleton h-3 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }, (_, r) => (
      <div key={r} className="flex gap-3 items-center">
        {Array.from({ length: cols }, (_, c) => (
          <div key={c} className={cn('skeleton h-4 flex-1', c === 0 && 'max-w-28')} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonCards: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div role="status" aria-label="Loading" className="space-y-2.5">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="border border-[#EBD9BC] rounded-lg bg-white p-4 space-y-2.5">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-4 w-44" />
        <div className="skeleton h-3 w-24" />
      </div>
    ))}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  hint?: string;
  actions?: React.ReactNode;
}> = ({ title, hint, actions }) => (
  <div className="px-4 py-14 text-center">
    <PackageOpen aria-hidden="true" size={30} className="mx-auto text-[#483828]/25" />
    <h3 className="mt-3 text-sm font-semibold text-[#483828]">{title}</h3>
    {hint && <p className="mt-1 text-xs text-[#483828]/65 max-w-sm mx-auto leading-relaxed">{hint}</p>}
    {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  hint?: string;
  onRetry?: () => void;
  actions?: React.ReactNode;
}> = ({ title = "Couldn't load this", hint, onRetry, actions }) => (
  <div role="alert" className="px-4 py-14 text-center">
    <AlertTriangle aria-hidden="true" size={28} className="mx-auto text-[#A33A28]" />
    <h3 className="mt-3 text-sm font-semibold text-[#A33A28]">{title}</h3>
    <p className="mt-1 text-xs text-[#483828]/70 max-w-sm mx-auto leading-relaxed">
      {hint ?? "We're having trouble fetching this. Please try again."}
    </p>
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-md bg-[#87380F] hover:bg-[#6D2D0C] text-white text-xs font-semibold"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
      )}
      {actions}
    </div>
  </div>
);
