import { useCallback, useState } from 'react';

/**
 * State kept in sessionStorage: it survives moving between sections and reloads,
 * and starts fresh when the app is closed. Invalid stored values fall back to `initial`.
 */
export function useSessionState<T>(key: string, initial: () => T, isValid: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      // Unavailable or corrupt storage: use the default.
    }
    return initial();
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable: the value just won't survive a reload.
      }
    },
    [key],
  );

  return [value, update] as const;
}
