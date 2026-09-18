import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
