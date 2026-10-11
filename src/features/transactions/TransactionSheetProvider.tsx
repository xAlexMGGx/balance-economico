import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAccounts, useCategories, useGroups, useSetting, useTags, useTransactions } from '../../data';
import type { ISODate, Transaction } from '../../domain/types';
import { TransactionForm, type SheetRequest } from './TransactionForm';

interface TransactionSheetApi {
  /** Opens the sheet to add a movement, optionally on a given day. */
  openNew: (options?: { date?: ISODate }) => void;
  openEdit: (transaction: Transaction) => void;
}

const TransactionSheetContext = createContext<TransactionSheetApi | null>(null);

export function useTransactionSheet(): TransactionSheetApi {
  const api = useContext(TransactionSheetContext);
  if (!api) throw new Error('useTransactionSheet must be used inside <TransactionSheetProvider>');
  return api;
}

export function TransactionSheetProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<SheetRequest | null>(null);
  // A new key per opening, so the form always starts from a clean state.
  const [openCount, setOpenCount] = useState(0);

  const api = useMemo<TransactionSheetApi>(
    () => ({
      openNew: (options) => {
        setRequest({ kind: 'new', date: options?.date });
        setOpenCount((n) => n + 1);
      },
      openEdit: (transaction) => {
        setRequest({ kind: 'edit', transaction });
        setOpenCount((n) => n + 1);
      },
    }),
    [],
  );
  const close = useCallback(() => setRequest(null), []);

  return (
    <TransactionSheetContext.Provider value={api}>
      {children}
      {request && <TransactionSheet key={openCount} request={request} onClose={close} />}
    </TransactionSheetContext.Provider>
  );
}

/** Waits for the data the form needs, so the form can set its initial state in one go. */
function TransactionSheet({ request, onClose }: { request: SheetRequest; onClose: () => void }) {
  const accounts = useAccounts();
  const categories = useCategories();
  const groups = useGroups();
  const tags = useTags();
  const transactions = useTransactions();
  const lastAccountId = useSetting('lastAccountId');

  if (!accounts || !categories || !groups || !tags || !transactions || lastAccountId === undefined) return null;

  return (
    <TransactionForm
      request={request}
      onClose={onClose}
      accounts={accounts}
      categories={categories}
      groups={groups}
      tags={tags}
      transactions={transactions}
      lastAccountId={lastAccountId}
    />
  );
}
