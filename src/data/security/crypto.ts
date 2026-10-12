import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { managedNonce } from '@noble/ciphers/utils.js';

// Key handling for the app lock.
//
// A random data key encrypts every record. It is never stored as is: it is stored wrapped
// (encrypted) once with a key derived from the password and, optionally, once with a key derived
// from the Face ID passkey (WebAuthn PRF). Changing the password only re-wraps the data key.
//
// Records are encrypted synchronously (XChaCha20-Poly1305, @noble/ciphers): IndexedDB transactions
// close as soon as the code waits for anything else, so record encryption cannot be async.
// Password and Face ID keys use WebCrypto, which is async, outside of any transaction.

export const DATA_KEY_BYTES = 32;
/** OWASP's recommendation for PBKDF2-HMAC-SHA256. Takes well under a second on an iPhone. */
export const PBKDF2_ITERATIONS = 600_000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const recordCipher = managedNonce(xchacha20poly1305);

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Copies into a fresh ArrayBuffer-backed array, as WebCrypto expects. */
const bytes = (data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(data);

/** A data key encrypted with AES-GCM. */
export interface WrappedKey {
  iv: Uint8Array;
  data: Uint8Array;
}

export async function passwordKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Key from the secret the Face ID passkey returns (WebAuthn PRF output). */
export async function prfKey(prfOutput: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', bytes(prfOutput), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('balance-economico/face-id') },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapDataKey(wrappingKey: CryptoKey, dataKey: Uint8Array): Promise<WrappedKey> {
  const iv = randomBytes(12);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, bytes(dataKey)));
  return { iv, data };
}

/** The data key, or null if the wrapping key is wrong (wrong password, other passkey). */
export async function unwrapDataKey(wrappingKey: CryptoKey, wrapped: WrappedKey): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(wrapped.iv) }, wrappingKey, bytes(wrapped.data)));
  } catch {
    return null;
  }
}

/** Encrypts a JSON value. The random nonce travels at the start of the result. */
export function encryptJson(dataKey: Uint8Array, value: unknown): Uint8Array {
  return recordCipher(dataKey).encrypt(encoder.encode(JSON.stringify(value)));
}

/** Throws if the payload was not encrypted with this key or was altered. */
export function decryptJson(dataKey: Uint8Array, payload: Uint8Array): unknown {
  return JSON.parse(decoder.decode(recordCipher(dataKey).decrypt(payload)));
}
