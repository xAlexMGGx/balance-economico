import { normalizeText } from './text';
import type { Category, Cents, ISODate, Transaction, TxType } from './types';

export function signedAmount(tx: Pick<Transaction, 'type' | 'amount'>): Cents {
  return tx.type === 'income' ? tx.amount : -tx.amount;
}

/** Most recent first; movements of the same day keep the order in which they were added (newest first). */
export function sortTransactionsDesc<T extends Pick<Transaction, 'date' | 'createdAt'>>(txs: readonly T[]): T[] {
  return [...txs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

export interface TransactionFilter {
  /** null = all accounts. */
  accountId: string | null;
  categoryId: string | null;
  tagId: string | null;
  /** Free text matched against the title, ignoring case and accents. */
  search: string;
}

export const EMPTY_FILTER: TransactionFilter = { accountId: null, categoryId: null, tagId: null, search: '' };

export function filterTransactions(txs: readonly Transaction[], filter: TransactionFilter): Transaction[] {
  const query = normalizeText(filter.search);
  return txs.filter(
    (tx) =>
      (filter.accountId === null || tx.accountId === filter.accountId) &&
      (filter.categoryId === null || tx.categoryId === filter.categoryId) &&
      (filter.tagId === null || tx.tagIds.includes(filter.tagId)) &&
      (query === '' || (tx.title !== null && normalizeText(tx.title).includes(query))),
  );
}

export interface DayGroup {
  date: ISODate;
  transactions: Transaction[];
  income: Cents;
  expense: Cents;
}

/** Groups movements by day, most recent day first. */
export function groupByDay(txs: readonly Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of sortTransactionsDesc(txs)) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== tx.date) {
      group = { date: tx.date, transactions: [], income: 0, expense: 0 };
      groups.push(group);
    }
    group.transactions.push(tx);
    if (tx.type === 'income') group.income += tx.amount;
    else group.expense += tx.amount;
  }
  return groups;
}

export function countBy<T>(items: readonly T[], keys: (item: T) => readonly string[] | string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = keys(item);
    for (const key of typeof k === 'string' ? [k] : k) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Categories of a type for the quick picker: most used first, then in the user's own order. */
export function sortCategoriesByUsage(
  categories: readonly Category[],
  usage: ReadonlyMap<string, number>,
  type: TxType,
): Category[] {
  return categories
    .filter((c) => c.type === type)
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.order - b.order);
}

export interface TitleSuggestion {
  title: string;
  /** Category of the most recent movement with this title. */
  categoryId: string;
  count: number;
  lastDate: ISODate;
}

/** Previous titles of a type, deduplicated ignoring case and accents; most used, then most recent, first. */
export function buildTitleSuggestions(txs: readonly Transaction[], type: TxType): TitleSuggestion[] {
  const byKey = new Map<string, TitleSuggestion>();
  for (const tx of sortTransactionsDesc(txs)) {
    if (tx.type !== type || !tx.title) continue;
    const key = normalizeText(tx.title);
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { title: tx.title, categoryId: tx.categoryId, count: 1, lastDate: tx.date });
  }
  return [...byKey.values()].sort(
    (a, b) => b.count - a.count || (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0),
  );
}

/** Suggestions containing the query. Hides the one that is exactly what has already been typed. */
export function matchTitleSuggestions(
  suggestions: readonly TitleSuggestion[],
  query: string,
  limit = 5,
): TitleSuggestion[] {
  const q = normalizeText(query);
  return suggestions
    .filter((s) => {
      const title = normalizeText(s.title);
      return title.includes(q) && title !== q;
    })
    .slice(0, limit);
}
