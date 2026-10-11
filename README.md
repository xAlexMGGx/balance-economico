# Balance

Personal expense and income tracker, built as a PWA for iPhone. All data stays on the device (IndexedDB).

Live app: https://xalexmggx.github.io/balance-economico/

## Development

```bash
npm install
npm run dev        # http://localhost:5173/balance-economico/
npm test           # unit tests (Vitest)
npm run build      # production build in dist/
```

To try it on the iPhone while developing, run `npm run dev -- --host` and open the "Network" URL from Safari (same Wi-Fi).

Every push to `main` is built and published to GitHub Pages by `.github/workflows/deploy.yml`.

## PWA

`vite-plugin-pwa` generates the manifest and a Workbox service worker that precaches the whole app, so it works offline. Updates use the prompt strategy: the app shows "Hay una versión nueva" and only switches when the user taps "Actualizar" (`src/components/UpdatePrompt.tsx`). The build time is shown in Ajustes to check which version is installed.

Icons live in `public/`. `icon.svg` is the full-bleed source; the PNGs (`pwa-192x192`, `pwa-512x512`, `maskable-icon-512x512`, `apple-touch-icon` 180×180) were rendered from it, and `favicon.svg` is the same drawing with rounded corners.

## Structure

- `src/domain/` — types and pure logic (money, dates, periods, filters, balances, analytics, calendar), with tests. No React, no Dexie.
- `src/data/` — the only access to data: Dexie schema (`db.ts`), repositories and reactive hooks. Screens import from `src/data/index.ts`.
- `src/components/` — reusable UI (bottom sheet, keypad, dialogs, layout).
- `src/features/` — screens: analysis, calendar, transactions, settings.
