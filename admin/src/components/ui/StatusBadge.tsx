import React from 'react';
import { cn } from '../../lib/cn';

/**
 * Status is colour AND text, never colour alone.
 *
 * Colour alone fails a colour-blind reader and fails a printed pick list,
 * which is how these orders actually get packed. See docs/ADMIN.md §2.
 */
type Tone = 'neutral' | 'pending' | 'progress' | 'info' | 'success' | 'danger' | 'muted';

const TONES: Record<Tone, string> = {
  neutral: 'bg-[#483828]/8 text-[#483828]',
  pending: 'bg-[#B69A55]/18 text-[#7a6221]',
  progress: 'bg-[#87380F]/12 text-[#87380F]',
  info: 'bg-[#647044]/14 text-[#42522a]',
  success: 'bg-[#647044]/20 text-[#33421f]',
  danger: 'bg-[#A33A28]/12 text-[#A33A28]',
  muted: 'bg-[#483828]/8 text-[#483828]/65',
};

const ORDER_STATUS: Record<string, Tone> = {
  pending: 'pending',
  confirmed: 'progress',
  packed: 'info',
  shipped: 'progress',
  delivered: 'success',
  cancelled: 'muted',
  failed: 'danger',
  rto: 'danger',
  returned: 'muted',
  refunded: 'muted',
};

const PAYMENT_STATUS: Record<string, Tone> = {
  pending: 'pending',
  paid: 'success',
  failed: 'danger',
  refunded: 'muted',
  partially_refunded: 'muted',
};

export const StatusBadge: React.FC<{
  status: string;
  kind?: 'order' | 'payment' | 'stock';
  className?: string;
}> = ({ status, kind = 'order', className }) => {
  const map = kind === 'payment' ? PAYMENT_STATUS : ORDER_STATUS;
  const tone = map[status] ?? 'neutral';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold capitalize',
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

export const StockBadge: React.FC<{ qty: number; threshold?: number }> = ({ qty, threshold = 10 }) => {
  const tone: Tone = qty === 0 ? 'danger' : qty <= threshold ? 'pending' : 'success';
  const label = qty === 0 ? 'Out of Stock' : qty <= threshold ? 'Low Stock' : 'In Stock';
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold', TONES[tone])}>
      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};
