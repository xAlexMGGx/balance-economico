import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// Account filter shared by Movimientos and Calendario, kept while the app stays open.

const STORAGE_KEY = 'accountFilter';

interface AccountFilter {
  /** null = all accounts. */
  accountId: string | null;
  setAccountId: (id: string | null) => void;
}

const AccountFilterContext = createContext<AccountFilter | null>(null);

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AccountFilterProvider({ children }: { children: ReactNode }) {
  const [accountId, setState] = useState<string | null>(readStored);

  const setAccountId = useCallback((id: string | null) => {
    setState(id);
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the filter just won't survive a reload.
    }
  }, []);

  return <AccountFilterContext.Provider value={{ accountId, setAccountId }}>{children}</AccountFilterContext.Provider>;
}

export function useAccountFilter(): AccountFilter {
  const value = useContext(AccountFilterContext);
  if (!value) throw new Error('useAccountFilter must be used inside <AccountFilterProvider>');
  return value;
}
