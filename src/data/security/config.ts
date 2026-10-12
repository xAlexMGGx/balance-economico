import type { WrappedKey } from './crypto';

/** Stored in the `security` table (one record, id "config") while the app lock is on. */
export interface SecurityConfig {
  id: 'config';
  password: {
    salt: Uint8Array;
    iterations: number;
    wrappedKey: WrappedKey;
  };
  faceId: {
    credentialId: Uint8Array;
    prfSalt: Uint8Array;
    wrappedKey: WrappedKey;
  } | null;
  createdAt: string;
}

export const MIN_PASSWORD_LENGTH = 8;
/** The app locks again after this long in the background. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;
