import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'waschen.png',
        'waschen.webp',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-256x256.png',
        'pwa-512x512.png',
        'favicon.png',
      ],
      manifest: {
        name: 'Waschen Mobile',
        short_name: 'Waschen',
        description: 'Aplikasi Waschen Mobile Alora Indonesia',
        theme_color: '#5f1340',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-256x256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        related_applications: [
          {
            platform: 'webapp',
            url: '/manifest.webmanifest',
          },
        ],
        prefer_related_applications: false,
      },
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
    }),
  ],
  server: {
    port: 9000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  esbuild: {
    supported: {
      destructuring: true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        destructuring: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('html5-qrcode')) return 'scanner';
          if (id.includes('@simplewebauthn')) return 'webauthn';
          return 'vendor';
        },
      },
    },
  },
});
