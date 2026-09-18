import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutGrid, ClipboardList, Package, Boxes, MessageSquare, Ticket,
  Menu, X, MoreHorizontal, LogOut,
} from 'lucide-react';
import { cn } from '../lib/cn';
import type { AdminIdentity } from '../api/client';

/**
 * Navigation.
 *
 * Only sections that exist. The reference design also showed Customers,
 * Reports and Settings; there is no backend behind them, and a nav item that
 * leads nowhere teaches the operator to distrust the nav.
 */
interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  /** Hidden from staff entirely — not shown disabled. */
  ownerOnly?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/reviews', label: 'Reviews', icon: MessageSquare },
  { to: '/coupons', label: 'Coupons', icon: Ticket, ownerOnly: true },
];

/** The four reached most often during a packing session. */
const MOBILE_PRIMARY = ['/', '/orders', '/inventory'];

const Logo: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <div className={cn('flex items-center gap-2.5', compact && 'gap-2')}>
    <span
      aria-hidden="true"
      className="grid place-items-center w-8 h-8 rounded-lg bg-[#87380F] text-[#FAF6F0] text-xs font-bold shrink-0"
    >
      SV
    </span>
    {!compact && (
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-[#483828]">S V Home Products</span>
        <span className="block text-[11px] text-[#483828]/55">Admin Panel</span>
      </span>
    )}
  </div>
);

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 min-h-11 px-3 rounded-md text-sm transition-colors',
    isActive
      ? 'bg-[#F3E7D0] text-[#87380F] font-semibold'
      : 'text-[#483828] hover:bg-[#F3E7D0]/60',
  );

export const Sidebar: React.FC<{ me?: AdminIdentity; onSignOut: () => void }> = ({ me, onSignOut }) => (
  <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[200px] flex-col border-r border-[#EBD9BC] bg-white">
    <div className="px-4 py-5">
      <Logo />
    </div>

    <nav className="flex-1 px-2 space-y-0.5" aria-label="Sections">
      {NAV.filter((n) => !n.ownerOnly || me?.role === 'owner').map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end ?? false} className={navClass}>
          <item.icon size={17} aria-hidden="true" className="shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>

    <div className="border-t border-[#EBD9BC] p-3">
      <div className="flex items-center gap-2.5 px-1">
        <span
          aria-hidden="true"
          className="grid place-items-center w-8 h-8 rounded-full bg-[#F3E7D0] text-[#87380F] text-xs font-bold shrink-0"
        >
          {me?.email?.[0]?.toUpperCase() ?? 'A'}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-xs font-semibold text-[#483828] capitalize">{me?.role}</span>
          <span className="block text-[11px] text-[#483828]/55 truncate">{me?.email}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="mt-2 w-full min-h-11 px-3 rounded-md border border-[#EBD9BC] text-xs font-semibold text-[#483828] hover:bg-[#F3E7D0]/60 inline-flex items-center justify-center gap-2"
      >
        <LogOut size={14} aria-hidden="true" />
        Sign out
      </button>
    </div>
  </aside>
);

export const MobileTopBar: React.FC<{ me?: AdminIdentity; onSignOut: () => void }> = ({ me, onSignOut }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-[#EBD9BC] bg-white px-2 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid place-items-center min-h-11 min-w-11 rounded-md hover:bg-[#F3E7D0]/60"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Logo compact />
        <span
          aria-hidden="true"
          className="grid place-items-center min-h-11 min-w-11 rounded-full text-xs font-bold text-[#87380F]"
        >
          <span className="grid place-items-center w-8 h-8 rounded-full bg-[#F3E7D0]">
            {me?.email?.[0]?.toUpperCase() ?? 'A'}
          </span>
        </span>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#483828]/40"
          />
          <div
            role="dialog"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col"
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBD9BC]">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid place-items-center min-h-11 min-w-11 rounded-md hover:bg-[#F3E7D0]/60"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-0.5" aria-label="Sections">
              {NAV.filter((n) => !n.ownerOnly || me?.role === 'owner').map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
                  onClick={() => setOpen(false)}
                  className={navClass}
                >
                  <item.icon size={17} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-[#EBD9BC] p-3">
              <p className="px-1 text-[11px] text-[#483828]/55 truncate">{me?.email}</p>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-2 w-full min-h-11 rounded-md border border-[#EBD9BC] text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                <LogOut size={14} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const MobileBottomNav: React.FC<{ me?: AdminIdentity }> = ({ me }) => {
  const primary = NAV.filter((n) => MOBILE_PRIMARY.includes(n.to));
  const rest = NAV.filter(
    (n) => !MOBILE_PRIMARY.includes(n.to) && (!n.ownerOnly || me?.role === 'owner'),
  );

  return (
    <nav
      aria-label="Primary"
      // Clear of the iPhone home indicator in standalone mode.
      style={{ paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom))' }}
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-[#EBD9BC] bg-white pt-1"
    >
      {primary.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end ?? false}
          className={({ isActive }) =>
            cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 text-[10px] font-medium',
              isActive ? 'text-[#87380F] font-semibold' : 'text-[#483828]/65',
            )
          }
        >
          <item.icon size={19} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
      <Link
        to={rest[0]?.to ?? '/products'}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 text-[10px] font-medium text-[#483828]/65"
      >
        <MoreHorizontal size={19} aria-hidden="true" />
        More
      </Link>
    </nav>
  );
};
