import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
      'destructuring': true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'destructuring': true,
      },
    },
  },
});
