import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pwa = VitePWA({
  // Never update behind the user's back: the app shows "Hay una versión nueva" and they choose when.
  registerType: 'prompt',
  // Registered from React (src/components/UpdatePrompt.tsx).
  injectRegister: false,
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    id: '/balance-economico/',
    name: 'Balance: gastos e ingresos',
    short_name: 'Balance',
    description: 'Tus gastos, ingresos y ahorro. Los datos se guardan solo en tu dispositivo.',
    lang: 'es',
    dir: 'ltr',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
    categories: ['finance'],
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    // Everything the app needs is cached on install, so it opens without connection.
    globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
    // Routes live in the hash, so every navigation is index.html.
    navigateFallback: 'index.html',
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the base must match the repo name.
  base: '/balance-economico/',
  define: {
    // Shown in Ajustes, so it is easy to check which version is installed.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss(), ...(process.env.VITEST ? [] : [pwa])],
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
