import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The admin is its own build, deployed to its own subdomain.
 *
 * Not a route inside the storefront: a customer should never download admin
 * code, and admin.<domain> can be IP-allowlisted at the CDN in a way that
 * <domain>/admin cannot. See docs/ADMIN.md §1.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    // In development the API is on another port, which is cross-origin — the
    // same shape as production, where it is on another subdomain. Proxying
    // would hide CORS and cookie problems until deploy.
    proxy: {},
  },
});
