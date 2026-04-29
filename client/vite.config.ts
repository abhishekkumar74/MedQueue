import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'MedQueue',
        short_name: 'MedQueue',
        description: 'Hospital Queue Management System',
        theme_color: '#005EB8',
        background_color: '#E8F3FF',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Stale-while-revalidate for read API endpoints
            urlPattern: /\/functions\/v1\/hospital-api\/api\/(queue|token\/status)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'medqueue-api-v1',
              expiration: {
                maxAgeSeconds: 300, // 5 minutes
              },
            },
          },
          {
            // Network-only for mutation endpoints (never cache writes)
            urlPattern: /\/functions\/v1\/hospital-api\/api\/(token\/register|prescription|appointment\/book)/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
