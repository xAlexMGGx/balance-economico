// In-memory state of the app lock: whether it is enabled and, when unlocked, the data key.
// The key only ever lives here, in memory, and is wiped when the app locks.

export type LockStatus = 'loading' | 'disabled' | 'locked' | 'unlocked';

/** Reading or writing protected data while the app is locked. */
export class LockedError extends Error {
  constructor() {
    super('La app está bloqueada.');
    this.name = 'LockedError';
  }
}

let loaded = false;
let enabled = false;
let dataKey: Uint8Array | null = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

export const keyring = {
  /** The data key, or null when locked or when the lock is off. */
  get key(): Uint8Array | null {
    return dataKey;
  },

  /** Whether new data must be written encrypted. */
  get encrypting(): boolean {
    return enabled;
  },

  status(): LockStatus {
    if (!loaded) return 'loading';
    if (!enabled) return 'disabled';
    return dataKey ? 'unlocked' : 'locked';
  },

  setEnabled(value: boolean): void {
    loaded = true;
    enabled = value;
    notify();
  },

  setKey(key: Uint8Array): void {
    dataKey = key;
    notify();
  },

  /** Forgets the key (and overwrites it in memory). */
  clearKey(): void {
    dataKey?.fill(0);
    dataKey = null;
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Back to the initial state. For tests. */
  reset(): void {
    loaded = false;
    enabled = false;
    dataKey = null;
    notify();
  },
};
