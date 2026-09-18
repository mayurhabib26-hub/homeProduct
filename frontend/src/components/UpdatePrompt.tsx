import React from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Offers a refresh when a new build is available.
 *
 * Never during checkout: an automatic or mistimed reload mid-payment is a
 * lost order. The prompt is suppressed on those routes and reappears on the
 * next navigation. See docs/PWA.md §7.
 */
export const UpdatePrompt: React.FC = () => {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const inCheckout = pathname.startsWith('/checkout') || pathname.startsWith('/order');
  if (!needRefresh || inCheckout) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#483828] text-[#FAF6F0] shadow-lg font-sans text-sm"
    >
      <span>A new version is available.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="px-3 py-1.5 rounded bg-[#87380F] hover:bg-[#6d2d0c] text-xs font-bold tracking-wider uppercase transition-colors"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notice"
        className="text-[#FAF6F0]/60 hover:text-[#FAF6F0] transition-colors"
      >
        ✕
      </button>
    </div>
  );
};
