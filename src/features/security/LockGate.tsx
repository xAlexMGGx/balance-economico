import { useEffect, type ReactNode } from 'react';
import { LOCK_AFTER_MS, securityRepo, useLockStatus } from '../../data';
import { LockScreen } from './LockScreen';

/**
 * Shows the app only when its data can be read: right away if the lock is off, after Face ID or
 * the password if it is on. Nothing below this reads data while locked.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const status = useLockStatus();

  useEffect(() => {
    securityRepo.init().catch((error: unknown) => console.error('Could not read the lock settings', error));
  }, []);

  // Lock again after some time in the background.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null && Date.now() - hiddenAt >= LOCK_AFTER_MS) securityRepo.lock();
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  if (status === 'loading') return null;
  if (status === 'locked') return <LockScreen />;
  return <>{children}</>;
}
