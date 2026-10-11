import type { Account, Category, Transaction } from '../domain/types';

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;
const META = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: nextId('tx'),
    type: 'expense',
    amount: 1000,
    date: '2026-10-11',
    accountId: 'bank',
    categoryId: 'food',
    title: null,
    tagIds: [],
    recurringRuleId: null,
    recurringMonth: null,
    ...META,
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: nextId('cat'),
    name: 'Categoría',
    color: '#ef4444',
    icon: '🛒',
    type: 'expense',
    groupId: 'needs',
    order: 0,
    ...META,
    ...overrides,
  };
}

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: nextId('acc'),
    name: 'Cuenta',
    color: '#3b82f6',
    initialBalance: 0,
    countsForSavings: true,
    order: 0,
    ...META,
    ...overrides,
  };
}
