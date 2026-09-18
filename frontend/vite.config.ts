import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', never 'autoUpdate': an automatic skipWaiting reload during
      // checkout is a lost order. See docs/PWA.md §7.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'S V Home Products',
        short_name: 'S V Home',
        description: 'Authentic South Indian homemade food products and handcrafted spice powders',
        // Tagged so GA4 can tell installed sessions from direct traffic.
        start_url: '/?source=pwa',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#87380F',
        background_color: '#FAF6F0',
        lang: 'en-IN',
        categories: ['food', 'shopping'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Without a maskable icon Android crops the seal into a circle and
          // clips it. See docs/PWA.md §4.
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Shop', url: '/shop' },
          { name: 'Recipes', url: '/recipes' },
        ],
      },
      workbox: {
        // Phase 0 is installability only: precache the shell, cache nothing
        // else. The per-route runtime strategies land in Phase 7, once the
        // catalogue is served over HTTP and there are API routes to classify.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Same relative /api URLs in dev as in production — no environment
    // branch, no CORS path that exists only locally. docs/DEPLOYMENT.md §2.
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
