import React from 'react';
import { cn } from '../../lib/cn';

/**
 * Every variant clears 44px. Radii stay small (6-8px) — the storefront is
 * the soft one; this is a tool.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#87380F] hover:bg-[#6D2D0C] text-white disabled:bg-[#87380F]/40',
  secondary: 'bg-white hover:bg-[#F3E7D0]/60 text-[#483828] border border-[#EBD9BC]',
  ghost: 'text-[#483828] hover:bg-[#F3E7D0]/60',
  danger: 'bg-[#A33A28] hover:bg-[#8c3022] text-white disabled:bg-[#A33A28]/35',
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; compact?: boolean }
>(({ variant = 'primary', compact, className, children, ...rest }, ref) => (
  <button
    ref={ref}
    {...rest}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors',
      'min-h-11 disabled:cursor-not-allowed',
      compact ? 'px-3' : 'px-4',
      VARIANTS[variant],
      className,
    )}
  >
    {children}
  </button>
));
Button.displayName = 'Button';

/**
 * An action the current role cannot perform.
 *
 * Shown disabled with a reason rather than hidden, so staff understand what
 * the system can do and do not think a feature is missing. Genuinely
 * sensitive surfaces — the audit log, owner settings — are hidden entirely
 * instead. See docs/ADMIN.md §3.
 */
export const RestrictedAction: React.FC<{
  reason: string;
  children: React.ReactNode;
}> = ({ reason, children }) => (
  <span className="inline-flex flex-col items-start gap-1">
    <span className="contents">{children}</span>
    <span className="text-[11px] text-[#483828]/60">{reason}</span>
  </span>
);
