/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShopProvider } from './context/ShopContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchModal } from './components/SearchModal';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ToastNotification } from './components/ToastNotification';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { ScrollToTop } from './components/ScrollToTop';
import { UpdatePrompt } from './components/UpdatePrompt';
import { motion, AnimatePresence } from 'motion/react';

// Pages
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AboutPage } from './pages/AboutPage';
import { RecipesPage } from './pages/RecipesPage';
import { ContactPage } from './pages/ContactPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage, TrackOrderPage } from './pages/OrderConfirmationPage';

/**
 * Admin is lazy-loaded so none of it ships to customers. It is a large share
 * of the code and none of the storefront audience. See docs/ADMIN.md §1.
 */
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrderDetailPage })));
const AdminInventoryPage = lazy(() => import('./pages/admin/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })));
const AdminCouponsPage = lazy(() => import('./pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage').then((m) => ({ default: m.AdminReviewsPage })));

const AppContent: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#483828] font-sans antialiased selection:bg-[#EBD9BC] selection:text-[#87380F]">
      {/* Scroll indicator bar on top */}
      <ScrollProgressBar />

      {/* Top sticky navigation */}
      <Navbar />

      {/* Main page view with smooth transition.
          Keyed on pathname so the transition survives the move off the old
          activePage string — same animation, real URLs underneath. */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="flex-1"
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/:slug" element={<RecipesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
            <Route path="/track" element={<TrackOrderPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </motion.main>
      </AnimatePresence>

      {/* Footer */}
      <Footer />

      {/* Overlays, Drawers & Scroll To Top */}
      <CartDrawer />
      <SearchModal />
      <FloatingWhatsApp />
      <MobileBottomNav />
      <ToastNotification />
      <ScrollToTop />
      <UpdatePrompt />
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The catalogue is not changing while someone reads a product page.
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const AdminFallback = () => (
  <div className="min-h-screen grid place-items-center text-sm text-[#483828]/60" role="status">
    Loading…
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Admin sits outside the storefront chrome: no navbar, footer or
              bottom nav, and no ShopProvider — it is a different product. */}
          <Route
            path="/admin/login"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminLoginPage />
              </Suspense>
            }
          />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<Suspense fallback={<AdminFallback />}><AdminDashboardPage /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<AdminFallback />}><AdminOrdersPage /></Suspense>} />
            <Route path="orders/:orderNumber" element={<Suspense fallback={<AdminFallback />}><AdminOrderDetailPage /></Suspense>} />
            <Route path="inventory" element={<Suspense fallback={<AdminFallback />}><AdminInventoryPage /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<AdminFallback />}><AdminProductsPage /></Suspense>} />
            <Route path="coupons" element={<Suspense fallback={<AdminFallback />}><AdminCouponsPage /></Suspense>} />
            <Route path="reviews" element={<Suspense fallback={<AdminFallback />}><AdminReviewsPage /></Suspense>} />
          </Route>

          <Route
            path="*"
            element={
              <ShopProvider>
                <AppContent />
              </ShopProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
