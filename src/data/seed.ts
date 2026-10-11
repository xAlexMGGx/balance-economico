import type { Account } from '../domain/types';
import { newId, nowTimestamp } from './ids';

/** Accounts created the first time the app opens. They can be edited or deleted from Ajustes. */
export function createDefaultAccounts(): Account[] {
  const now = nowTimestamp();
  const defaults: Array<Pick<Account, 'name' | 'color' | 'countsForSavings'>> = [
    { name: 'Banco', color: '#3b82f6', countsForSavings: true },
    { name: 'Edenred Restaurante', color: '#f97316', countsForSavings: false },
    { name: 'Edenred Transporte', color: '#14b8a6', countsForSavings: false },
  ];
  return defaults.map((account, index) => ({
    ...account,
    id: newId(),
    initialBalance: 0,
    order: index,
    createdAt: now,
    updatedAt: now,
  }));
}
