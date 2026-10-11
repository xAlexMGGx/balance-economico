import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the base must match the repo name.
  base: '/balance-economico/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: they rarely change, so an update only downloads the app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-vendor|@reduxjs|react-redux|immer|reselect|es-toolkit|decimal\.js-light)/.test(id)) {
            return 'charts';
          }
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Run the tests in Spain's timezone, so daylight saving changes are exercised.
    env: { TZ: 'Europe/Madrid' },
  },
});
