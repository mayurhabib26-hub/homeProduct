import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * A dashboard tile. Answers "does this need me now", not "how was the
 * quarter" — so the alert line matters more than the number.
 */
export const MetricCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  /** Shown under the value when action is needed. */
  alert?: string;
  delta?: string;
  to?: string;
}> = ({ label, value, icon, alert, delta, to }) => {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'grid place-items-center w-9 h-9 rounded-full shrink-0',
            alert ? 'bg-[#A33A28]/10 text-[#A33A28]' : 'bg-[#647044]/12 text-[#647044]',
          )}
        >
          {icon}
        </span>
        {to && <ChevronRight size={16} aria-hidden="true" className="text-[#483828]/30 mt-1" />}
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-wider text-[#483828]/55">{label}</p>
      <p className="tabular text-2xl font-bold text-[#483828] mt-0.5">{value}</p>
      {alert ? (
        <p className="text-[11px] font-semibold text-[#A33A28] mt-1">{alert}</p>
      ) : delta ? (
        <p className="text-[11px] text-[#647044] mt-1">{delta}</p>
      ) : null}
    </>
  );

  const shell = 'bg-white border border-[#EBD9BC] rounded-lg p-4 block';

  return to ? (
    <Link to={to} className={cn(shell, 'hover:bg-[#F3E7D0]/40 transition-colors')}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
};
