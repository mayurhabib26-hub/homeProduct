import React from 'react';
import { cn } from '../../lib/cn';

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  shortcuts?: boolean;
}> = ({ title, subtitle, actions, shortcuts }) => (
  <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
    <div>
      <h1 className="text-[28px] leading-9 lg:text-[28px] font-bold text-[#483828]">{title}</h1>
      {subtitle && <p className="text-sm text-[#483828]/65 mt-0.5">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-3">
      {/* Desktop only: a keyboard hint on a phone is noise. */}
      {shortcuts && <KeyboardHints />}
      {actions}
    </div>
  </header>
);

export const KeyboardHints: React.FC = () => (
  <div className="hidden lg:flex items-center gap-3 text-[11px] text-[#483828]/50">
    <span><Key>/</Key> search</span>
    <span><Key>j</Key><Key>k</Key> move</span>
    <span><Key>Enter</Key> open</span>
  </div>
);

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="inline-block min-w-5 px-1 py-0.5 mx-0.5 rounded border border-[#EBD9BC] bg-white text-center font-sans">
    {children}
  </kbd>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={cn('bg-white border border-[#EBD9BC] rounded-lg', className)}>{children}</div>
);

export const SectionTitle: React.FC<{
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}> = ({ children, count, action }) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#EBD9BC]">
    <h2 className="text-sm font-semibold text-[#483828] flex items-center gap-2">
      {children}
      {count !== undefined && count > 0 && (
        <span className="tabular rounded bg-[#87380F] px-1.5 py-0.5 text-[11px] font-bold text-white">
          {count}
        </span>
      )}
    </h2>
    {action}
  </div>
);

/** Filter pills with counts. The work queue is the default, not the archive. */
export const FilterTabs: React.FC<{
  options: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
    {options.map((o) => {
      const active = o.value === value;
      return (
        <button
          key={o.value || 'all'}
          role="tab"
          aria-selected={active}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 min-h-11 min-w-11 justify-center px-3 rounded-md text-xs font-medium transition-colors',
            active
              ? 'bg-[#87380F] text-white'
              : 'bg-white border border-[#EBD9BC] text-[#483828] hover:bg-[#F3E7D0]/60',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn('tabular text-[11px] font-bold', active ? 'text-white/80' : 'text-[#483828]/50')}>
              {o.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const SearchField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  id?: string;
}> = ({ value, onChange, placeholder, inputRef, id = 'search' }) => (
  <div className="relative flex-1 min-w-0">
    <label htmlFor={id} className="sr-only">{placeholder}</label>
    <input
      id={id}
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full min-h-11 rounded-md border border-[#EBD9BC] bg-white pl-3 pr-12 text-sm placeholder:text-[#483828]/40"
    />
    <kbd
      aria-hidden="true"
      className="hidden lg:block absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#EBD9BC] bg-[#FAF6F0] px-1.5 py-0.5 text-[11px] text-[#483828]/50"
    >
      /
    </kbd>
  </div>
);
