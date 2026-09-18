import React from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/client';

/**
 * Admin shell.
 *
 * This is the tool half of the product: system sans rather than the display
 * serif, dense layout, no motion beyond state feedback. It borrows the brand
 * palette so it does not feel like a different product, but the priorities
 * invert. See docs/ADMIN.md §2.
 */
export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: adminApi.me,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-[#483828]/60" role="status">
        Checking your session…
      </div>
    );
  }

  if (isError) return <Navigate to="/login" replace />;

  // min-h-11 (44px) on every target: the project's accessibility floor, and
  // the admin is used one-handed on a phone in a kitchen as often as at a desk.
  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center min-h-11 px-3 rounded text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#87380F]/40 ${
      isActive ? 'bg-[#87380F] text-white font-semibold' : 'text-[#483828] hover:bg-[#EBD9BC]/50'
    }`;

  return (
    <div className="min-h-screen bg-[#FAF6F0] font-sans text-[#483828]">
      <header className="border-b border-[#EBD9BC] bg-white">
        <div className="max-w-7xl mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm mr-4">S V Admin</span>
          <nav className="flex items-center gap-1 flex-1">
            <NavLink to="/" end className={link}>Dashboard</NavLink>
            <NavLink to="/orders" className={link}>Orders</NavLink>
            <NavLink to="/products" className={link}>Products</NavLink>
            <NavLink to="/inventory" className={link}>Inventory</NavLink>
            <NavLink to="/coupons" className={link}>Coupons</NavLink>
            <NavLink to="/reviews" className={link}>Reviews</NavLink>
          </nav>
          <span className="text-xs text-[#483828]/60 mr-3">
            {me?.email} · <span className="uppercase tracking-wide">{me?.role}</span>
          </span>
          <button
            type="button"
            onClick={async () => {
              await adminApi.logout();
              queryClient.clear();
              navigate('/login', { replace: true });
            }}
            className="text-xs min-h-11 px-3 border border-[#EBD9BC] rounded hover:bg-[#F3E7D0]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#87380F]/40"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet context={me} />
      </main>
    </div>
  );
};
