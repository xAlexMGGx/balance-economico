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

## Structure

- `src/domain/` — types and pure logic (money, dates, periods, filters, balances, analytics), with tests. No React, no Dexie.
- `src/data/` — the only access to data: Dexie schema (`db.ts`), repositories and reactive hooks. Screens import from `src/data/index.ts`.
- `src/components/` — reusable UI (bottom sheet, keypad, dialogs, layout).
- `src/features/` — screens: analysis, transactions, settings (calendar in a later phase).
