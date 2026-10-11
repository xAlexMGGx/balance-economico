import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the base must match the repo name.
  base: '/balance-economico/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    // Run the tests in Spain's timezone, so daylight saving changes are exercised.
    env: { TZ: 'Europe/Madrid' },
  },
});
