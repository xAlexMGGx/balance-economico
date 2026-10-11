import { describe, expect, it } from 'vitest';
import { makeCategory, makeTransaction as tx } from '../test/factories';
import {
  EMPTY_FILTER,
  buildTitleSuggestions,
  countBy,
  filterTransactions,
  groupByDay,
  matchTitleSuggestions,
  signedAmount,
  sortCategoriesByUsage,
  sortTransactionsDesc,
} from './transactions';

describe('signedAmount', () => {
  it('is positive for income and negative for expenses', () => {
    expect(signedAmount({ type: 'income', amount: 500 })).toBe(500);
    expect(signedAmount({ type: 'expense', amount: 500 })).toBe(-500);
  });
});

describe('sortTransactionsDesc', () => {
  it('orders by date, then by creation time, newest first', () => {
    const a = tx({ id: 'a', date: '2026-10-10', createdAt: '2026-10-10T09:00:00Z' });
    const b = tx({ id: 'b', date: '2026-10-11', createdAt: '2026-10-11T08:00:00Z' });
    const c = tx({ id: 'c', date: '2026-10-11', createdAt: '2026-10-11T20:00:00Z' });
    expect(sortTransactionsDesc([a, b, c]).map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('filterTransactions', () => {
  const items = [
    tx({ id: '1', accountId: 'bank', categoryId: 'food', title: 'Mercadona', tagIds: ['home'] }),
    tx({ id: '2', accountId: 'edenred', categoryId: 'lunch', title: 'Menú del día' }),
    tx({ id: '3', accountId: 'bank', categoryId: 'food', title: null, tagIds: ['home', 'trip'] }),
  ];
  const ids = (f: Partial<typeof EMPTY_FILTER>) => filterTransactions(items, { ...EMPTY_FILTER, ...f }).map((t) => t.id);

  it('returns everything with an empty filter', () => {
    expect(ids({})).toEqual(['1', '2', '3']);
  });

  it('filters by account, category and tag', () => {
    expect(ids({ accountId: 'bank' })).toEqual(['1', '3']);
    expect(ids({ categoryId: 'lunch' })).toEqual(['2']);
    expect(ids({ tagId: 'trip' })).toEqual(['3']);
    expect(ids({ accountId: 'bank', tagId: 'home' })).toEqual(['1', '3']);
  });

  it('searches the title ignoring case and accents', () => {
    expect(ids({ search: 'MENU' })).toEqual(['2']);
    expect(ids({ search: '  merca ' })).toEqual(['1']);
    expect(ids({ search: 'nada' })).toEqual([]);
  });
});

describe('groupByDay', () => {
  it('groups by date, newest day first, with daily totals', () => {
    const groups = groupByDay([
      tx({ date: '2026-10-10', amount: 300 }),
      tx({ date: '2026-10-11', amount: 1000 }),
      tx({ date: '2026-10-11', amount: 250000, type: 'income' }),
      tx({ date: '2026-10-11', amount: 500 }),
    ]);
    expect(groups.map((g) => [g.date, g.transactions.length, g.income, g.expense])).toEqual([
      ['2026-10-11', 3, 250000, 1500],
      ['2026-10-10', 1, 0, 300],
    ]);
  });

  it('returns no groups for no movements', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('countBy', () => {
  it('counts single and multiple keys', () => {
    const items = [tx({ categoryId: 'a', tagIds: ['x', 'y'] }), tx({ categoryId: 'a', tagIds: ['x'] }), tx({ categoryId: 'b' })];
    expect(Object.fromEntries(countBy(items, (t) => t.categoryId))).toEqual({ a: 2, b: 1 });
    expect(Object.fromEntries(countBy(items, (t) => t.tagIds))).toEqual({ x: 2, y: 1 });
  });
});

describe('sortCategoriesByUsage', () => {
  it('puts the most used first, then keeps the user order, and only includes the given type', () => {
    const categories = [
      makeCategory({ id: 'rent', order: 0 }),
      makeCategory({ id: 'food', order: 1 }),
      makeCategory({ id: 'fun', order: 2 }),
      makeCategory({ id: 'salary', order: 3, type: 'income', groupId: null }),
    ];
    const usage = new Map([
      ['food', 5],
      ['salary', 9],
    ]);
    expect(sortCategoriesByUsage(categories, usage, 'expense').map((c) => c.id)).toEqual(['food', 'rent', 'fun']);
    expect(sortCategoriesByUsage(categories, usage, 'income').map((c) => c.id)).toEqual(['salary']);
  });
});

describe('title suggestions', () => {
  const items = [
    tx({ title: 'Mercadona', categoryId: 'food', date: '2026-10-01' }),
    tx({ title: 'mercadona', categoryId: 'super', date: '2026-10-05' }),
    tx({ title: 'Cine', categoryId: 'fun', date: '2026-10-08' }),
    tx({ title: 'Café', categoryId: 'fun', date: '2026-10-09' }),
    tx({ title: 'Nómina', categoryId: 'salary', type: 'income', date: '2026-09-25' }),
    tx({ title: null }),
  ];

  it('deduplicates titles keeping the most recent spelling and category', () => {
    const suggestions = buildTitleSuggestions(items, 'expense');
    expect(suggestions[0]).toEqual({ title: 'mercadona', categoryId: 'super', count: 2, lastDate: '2026-10-05' });
  });

  it('sorts by use, then by recency, and separates expenses from income', () => {
    expect(buildTitleSuggestions(items, 'expense').map((s) => s.title)).toEqual(['mercadona', 'Café', 'Cine']);
    expect(buildTitleSuggestions(items, 'income').map((s) => s.title)).toEqual(['Nómina']);
  });

  it('matches part of the title ignoring accents and hides an exact match', () => {
    const suggestions = buildTitleSuggestions(items, 'expense');
    expect(matchTitleSuggestions(suggestions, 'caf').map((s) => s.title)).toEqual(['Café']);
    expect(matchTitleSuggestions(suggestions, 'C').map((s) => s.title)).toEqual(['mercadona', 'Café', 'Cine']);
    expect(matchTitleSuggestions(suggestions, 'cafe')).toEqual([]);
    expect(matchTitleSuggestions(suggestions, '', 2)).toHaveLength(2);
  });
});
