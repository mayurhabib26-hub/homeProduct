import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminLayout } from './pages/AdminLayout';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminOrderDetailPage } from './pages/AdminOrderDetailPage';
import { AdminInventoryPage } from './pages/AdminInventoryPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminProductEditPage } from './pages/AdminProductEditPage';
import { AdminCouponsPage } from './pages/AdminCouponsPage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Routes are at the root, not under /admin — this app IS the admin, served
 * from its own subdomain.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ErrorBoundary area="admin">
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:orderNumber" element={<AdminOrderDetailPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          {/* "new" before ":slug" — otherwise /products/new is read as a slug. */}
          <Route path="products/new" element={<AdminProductEditPage />} />
          <Route path="products/:slug/edit" element={<AdminProductEditPage />} />
          <Route path="inventory" element={<AdminInventoryPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  </QueryClientProvider>
);
