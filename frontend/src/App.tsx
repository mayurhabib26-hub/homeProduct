/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShopProvider } from './context/ShopContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { SearchModal } from './components/SearchModal';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ToastNotification } from './components/ToastNotification';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { ScrollToTop } from './components/ScrollToTop';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MotionConfig } from 'motion/react';
import ConsentBanner from './components/ConsentBanner';
import { ScrollReset } from './components/ScrollReset';
import LoginPage from './pages/LoginPage';
import AccountPage from './pages/AccountPage';
import { initAnalytics, pageView } from './lib/analytics';

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
import { PolicyPage } from './pages/PolicyPage';


const AppContent: React.FC = () => {
  const location = useLocation();

  // The tag is configured with send_page_view: false, so a route change is
  // counted here and nowhere else — otherwise the first load is counted twice.
  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => { pageView(location.pathname, document.title); }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6F0] text-[#483828] font-sans antialiased selection:bg-[#EBD9BC] selection:text-[#87380F]">
      {/* Scroll indicator bar on top */}
      <ScrollReset />

      <ScrollProgressBar />

      {/* Top sticky navigation */}
      <Navbar />

      {/*
        No page transition.

        This was <AnimatePresence mode="wait"> around a motion.main keyed on
        pathname. Under React 19 StrictMode the entering page mounted at its
        `initial` state — opacity 0 — and the enter animation never fired, so
        every client-side navigation left the PREVIOUS page on screen while
        the URL changed underneath it. The new page was in the DOM the whole
        time, invisible.

        Replacing it with a CSS fade fixed the routing but kept the shape of
        the problem: anything that stops the animation advancing leaves the
        page at opacity 0. A 280ms fade is not worth a failure mode where the
        site appears blank, so navigation is now plain. The page is visible
        because it is rendered, not because something animated it.
      */}
      <main className="flex-1">
          <ErrorBoundary area="page">
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/policies/:slug" element={<PolicyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>
      </main>

      {/* Footer */}
      <Footer />
      <ConsentBanner />

      {/* Overlays, Drawers & Scroll To Top */}
      <CartDrawer />
      <SearchModal />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        framer-motion animates through inline styles, so the reduced-motion
        media query in index.css cannot reach the page transitions or the
        scroll bar. reducedMotion="user" makes every motion component here
        follow the operating system setting instead.
      */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <ShopProvider>
            <AppContent />
          </ShopProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
