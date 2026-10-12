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

## Backups

Ajustes › Copia de seguridad exports every table to a JSON file (format and validation in `src/domain/backup.ts`), offered through the iOS share sheet so it can be saved to iCloud Drive. Importing validates the file, shows what it contains and replaces all data in one transaction. A reminder appears in Análisis when the last copy is more than 7 days old. Backups are plain JSON, also when the lock is on.

## App lock and encryption

Ajustes › Bloqueo y cifrado (`src/data/security/`, `src/data/repositories/security.ts`):

- A random 32-byte data key encrypts the records. It is stored only wrapped: with a key derived from the password (PBKDF2-SHA256, 600,000 iterations, AES-GCM) and, optionally, with a key derived from a Face ID passkey through the WebAuthn PRF extension (HKDF, AES-GCM). Changing the password re-wraps the data key without re-encrypting the data.
- A Dexie middleware (`security/middleware.ts`) encrypts records of accounts, groups, categories, tags, transactions and recurring rules with XChaCha20-Poly1305 (`@noble/ciphers`). It is synchronous on purpose: IndexedDB transactions close if the code awaits non-IndexedDB work. Primary keys and indexed fields (ids, dates, order) stay readable so queries keep working; everything else is one encrypted payload. Repositories and screens are unaware of it.
- The data key only lives in memory (`security/keyring.ts`). While locked, any read or write of protected data throws, so nothing is ever written in the clear by mistake. `LockGate` keeps every screen unmounted until the app is unlocked, and locks again after 5 minutes in the background.
- Forgetting the password without Face ID means the data cannot be decrypted; the lock screen offers to erase everything so a backup can be imported.

## Structure

- `src/domain/` — types and pure logic (money, dates, periods, filters, balances, analytics, calendar), with tests. No React, no Dexie.
- `src/data/` — the only access to data: Dexie schema (`db.ts`), repositories, reactive hooks and the encryption layer (`security/`). Screens import from `src/data/index.ts`.
- `src/components/` — reusable UI (bottom sheet, keypad, dialogs, layout).
- `src/features/` — screens: analysis, calendar, transactions, settings, backup, security.
