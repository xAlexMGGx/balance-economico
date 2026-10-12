import { db } from '../db';
import { nowTimestamp } from '../ids';
import { MIN_PASSWORD_LENGTH, type SecurityConfig } from '../security/config';
import {
  DATA_KEY_BYTES,
  PBKDF2_ITERATIONS,
  passwordKey,
  prfKey,
  randomBytes,
  unwrapDataKey,
  wrapDataKey,
} from '../security/crypto';
import { keyring } from '../security/keyring';
import { ENCRYPTED_TABLES } from '../security/middleware';
import { getPrfSecret, registerPasskey } from '../security/webauthn';
import { RepositoryError } from './common';

const CONFIG_ID = 'config';

const loadConfig = () => db.security.get(CONFIG_ID);

async function requireConfig(): Promise<SecurityConfig> {
  const config = await loadConfig();
  if (!config) throw new RepositoryError('El bloqueo no está activado.');
  return config;
}

function checkNewPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new RepositoryError(`La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

/** The data key for this password, or null if the password is wrong. */
async function dataKeyFromPassword(config: SecurityConfig, password: string): Promise<Uint8Array | null> {
  const { salt, iterations, wrappedKey } = config.password;
  return unwrapDataKey(await passwordKey(password, salt, iterations), wrappedKey);
}

async function wrapForPassword(dataKey: Uint8Array, password: string, iterations: number) {
  const salt = randomBytes(16);
  return { salt, iterations, wrappedKey: await wrapDataKey(await passwordKey(password, salt, iterations), dataKey) };
}

const encryptedTables = () => db.tables.filter((t) => ENCRYPTED_TABLES.has(t.name));

/**
 * Reads and writes back every protected record, inside the current transaction. Records go
 * through the encryption middleware both ways, so they end up encrypted or in the clear
 * depending on whether the lock is on at that moment.
 */
async function rewriteProtectedData(): Promise<void> {
  for (const table of encryptedTables()) {
    await table.bulkPut(await table.toArray());
  }
}

export const securityRepo = {
  /** Must run once at start, before anything reads or writes data. */
  async init(): Promise<void> {
    keyring.setEnabled((await loadConfig()) !== undefined);
  },

  /** Whether Face ID is set up (readable while locked). */
  async hasFaceId(): Promise<boolean> {
    return Boolean((await loadConfig())?.faceId);
  },

  /** Turns the lock on: creates the data key, wraps it with the password and encrypts all data. */
  async enable(password: string, { iterations = PBKDF2_ITERATIONS }: { iterations?: number } = {}): Promise<void> {
    if (await loadConfig()) throw new RepositoryError('El bloqueo ya está activado.');
    checkNewPassword(password);
    const dataKey = randomBytes(DATA_KEY_BYTES);
    const config: SecurityConfig = {
      id: CONFIG_ID,
      password: await wrapForPassword(dataKey, password, iterations),
      faceId: null,
      createdAt: nowTimestamp(),
    };
    keyring.setKey(dataKey);
    keyring.setEnabled(true);
    try {
      await db.transaction('rw', [...encryptedTables(), db.security], async () => {
        await db.security.put(config);
        await rewriteProtectedData();
      });
    } catch (error) {
      keyring.setEnabled(false);
      keyring.clearKey();
      throw error;
    }
  },

  /** Unlocks with the password. False if it is wrong. */
  async unlockWithPassword(password: string): Promise<boolean> {
    const dataKey = await dataKeyFromPassword(await requireConfig(), password);
    if (!dataKey) return false;
    keyring.setKey(dataKey);
    return true;
  },

  /** Unlocks with Face ID. Throws FaceIdError if it is cancelled or not available. */
  async unlockWithFaceId(): Promise<boolean> {
    const { faceId } = await requireConfig();
    if (!faceId) throw new RepositoryError('Face ID no está activado.');
    return securityRepo.unlockWithPrfSecret(await getPrfSecret(faceId.credentialId, faceId.prfSalt));
  },

  /** Second half of unlocking with Face ID, once the passkey has returned its secret. */
  async unlockWithPrfSecret(secret: ArrayBuffer | Uint8Array): Promise<boolean> {
    const { faceId } = await requireConfig();
    if (!faceId) return false;
    const dataKey = await unwrapDataKey(await prfKey(secret), faceId.wrappedKey);
    if (!dataKey) return false;
    keyring.setKey(dataKey);
    return true;
  },

  /** Creates the Face ID passkey and lets it unlock the data. The app must be unlocked. */
  async enableFaceId(): Promise<void> {
    const { credentialId, prfSalt, secret } = await registerPasskey();
    await securityRepo.saveFaceIdSecret(credentialId, prfSalt, secret);
  },

  /** Second half of enabling Face ID, once the passkey exists and has returned its secret. */
  async saveFaceIdSecret(credentialId: Uint8Array, prfSalt: Uint8Array, secret: ArrayBuffer | Uint8Array): Promise<void> {
    const dataKey = keyring.key;
    if (!dataKey) throw new RepositoryError('Desbloquea la app primero.');
    const wrappedKey = await wrapDataKey(await prfKey(secret), dataKey);
    await db.security.update(CONFIG_ID, { faceId: { credentialId, prfSalt, wrappedKey } });
  },

  /** Face ID stops unlocking the app. The passkey stays in Passwords until deleted there. */
  async disableFaceId(): Promise<void> {
    await db.security.update(CONFIG_ID, { faceId: null });
  },

  /** Changes the password. The data does not need to be encrypted again. */
  async changePassword(current: string, next: string): Promise<void> {
    const config = await requireConfig();
    const dataKey = await dataKeyFromPassword(config, current);
    if (!dataKey) throw new RepositoryError('La contraseña actual no es correcta.');
    checkNewPassword(next);
    await db.security.update(CONFIG_ID, { password: await wrapForPassword(dataKey, next, config.password.iterations) });
  },

  /** Turns the lock off: decrypts all data and forgets the keys. Needs the password. */
  async disable(password: string): Promise<void> {
    const config = await requireConfig();
    const dataKey = await dataKeyFromPassword(config, password);
    if (!dataKey) throw new RepositoryError('La contraseña no es correcta.');
    keyring.setKey(dataKey);
    keyring.setEnabled(false); // from now on, writes go in the clear; reads still decrypt
    try {
      await db.transaction('rw', [...encryptedTables(), db.security], async () => {
        await rewriteProtectedData();
        await db.security.delete(CONFIG_ID);
      });
    } catch (error) {
      keyring.setEnabled(true);
      throw error;
    }
    keyring.clearKey();
  },

  /** Locks now: the data key is wiped from memory. */
  lock(): void {
    if (keyring.encrypting) keyring.clearKey();
  },

  /** Deletes the whole database. The only way out after forgetting the password. */
  async eraseEverything(): Promise<void> {
    keyring.clearKey();
    await db.delete();
  },
};
