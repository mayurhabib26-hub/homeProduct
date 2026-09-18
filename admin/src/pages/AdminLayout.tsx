import React from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import { Sidebar, MobileTopBar, MobileBottomNav } from '../components/Shell';
import { ToastProvider } from '../components/ui/Toast';

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

  const signOut = async () => {
    await adminApi.logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#FAF6F0]">
        <Sidebar me={me} onSignOut={signOut} />
        <MobileTopBar me={me} onSignOut={signOut} />

        {/* pb-24 on mobile keeps content clear of the bottom nav. */}
        <main className="lg:pl-[200px]">
          <div className="mx-auto max-w-[1100px] px-4 py-5 lg:py-7 pb-24 lg:pb-10">
            <Outlet context={me} />
          </div>
        </main>

        <MobileBottomNav me={me} />
      </div>
    </ToastProvider>
  );
};
