import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Web-only config (browser IDE mode)
// For full Electron support, run: npm run electron:setup first
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to Express backend in dev
      '/api': 'http://localhost:3001',
      '/ws':  { target: 'ws://localhost:3001', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

