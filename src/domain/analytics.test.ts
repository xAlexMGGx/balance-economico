import { describe, expect, it } from 'vitest';
import { makeAccount, makeCategory, makeTransaction as tx } from '../test/factories';
import {
  UNGROUPED_ID,
  accountFlow,
  expensesByCategory,
  expensesByGroup,
  flowOf,
  sameRangeLastYear,
  savingsAccountIds,
  savingsSummary,
  transactionsInPeriod,
  transactionsToDate,
  variation,
  yearToDate,
} from './analytics';
import { periodContaining } from './periods';
import type { Group } from './types';

const october = periodContaining('month', '2026-10-11');
const septemberWeek = periodContaining('week', '2026-09-30'); // 28 Sep – 4 Oct
const thisWeek = periodContaining('week', '2026-10-11'); // 5 – 11 Oct

const recurring = { recurringRuleId: 'rule', recurringMonth: '2026-10' };

describe('transactionsInPeriod', () => {
  const salary = tx({ id: 'salary', type: 'income', amount: 250000, date: '2026-10-25', ...recurring });
  const coffee = tx({ id: 'coffee', date: '2026-10-07' });
  const rent = tx({ id: 'rent', date: '2026-10-06', ...recurring });
  const old = tx({ id: 'old', date: '2026-09-30' });

  it('counts recurring movements in their month, even if dated later than today', () => {
    expect(transactionsInPeriod([salary, coffee, rent, old], october).map((t) => t.id)).toEqual(['salary', 'coffee', 'rent']);
  });

  it('never counts recurring movements in a week, even when their date falls inside it', () => {
    expect(transactionsInPeriod([salary, coffee, rent, old], thisWeek).map((t) => t.id)).toEqual(['coffee']);
    expect(transactionsInPeriod([salary, coffee, rent, old], septemberWeek).map((t) => t.id)).toEqual(['old']);
  });
});

describe('transactionsToDate', () => {
  it('stops at the end date, except for recurring movements of that month', () => {
    const items = [
      tx({ id: 'jan', date: '2026-01-15' }),
      tx({ id: 'today', date: '2026-10-11' }),
      tx({ id: 'later', date: '2026-10-20' }),
      tx({ id: 'salary', date: '2026-10-25', ...recurring }),
      tx({ id: 'nextMonth', date: '2026-11-01', recurringRuleId: 'rule', recurringMonth: '2026-11' }),
      tx({ id: 'lastYear', date: '2025-12-31' }),
    ];
    expect(transactionsToDate(items, { start: '2026-01-01', end: '2026-10-11' }).map((t) => t.id)).toEqual([
      'jan',
      'today',
      'salary',
    ]);
  });
});

describe('flowOf', () => {
  it('returns null without movements, so the screen shows a dash', () => {
    expect(flowOf([])).toBeNull();
  });

  it('adds income and expenses', () => {
    expect(flowOf([tx({ type: 'income', amount: 1000 }), tx({ amount: 300 }), tx({ amount: 200 })])).toEqual({
      income: 1000,
      expense: 500,
      net: 500,
    });
  });
});

describe('savingsSummary', () => {
  const accounts = [makeAccount({ id: 'bank', countsForSavings: true }), makeAccount({ id: 'edenred', countsForSavings: false })];
  const savingsIds = savingsAccountIds(accounts);

  it('only uses savings accounts', () => {
    const items = [
      tx({ accountId: 'bank', type: 'income', amount: 200000, date: '2026-10-01' }),
      tx({ accountId: 'bank', amount: 50000, date: '2026-10-02' }),
      tx({ accountId: 'edenred', type: 'income', amount: 16000, date: '2026-10-01' }),
      tx({ accountId: 'edenred', amount: 9000, date: '2026-10-03' }),
    ];
    expect(savingsSummary(items, savingsIds, october)).toEqual({ savings: 150000, rate: 0.75 });
  });

  it('can be negative', () => {
    const items = [tx({ accountId: 'bank', type: 'income', amount: 1000 }), tx({ accountId: 'bank', amount: 1500 })];
    expect(savingsSummary(items, savingsIds, october)).toEqual({ savings: -500, rate: -0.5 });
  });

  it('has no rate without income, and no data without movements', () => {
    expect(savingsSummary([tx({ accountId: 'bank', amount: 1500 })], savingsIds, october)).toEqual({ savings: -1500, rate: null });
    expect(savingsSummary([tx({ accountId: 'edenred', amount: 1500 })], savingsIds, october)).toEqual({ savings: null, rate: null });
  });
});

describe('variation', () => {
  it('is good when savings go up and bad when they go down', () => {
    expect(variation(1500, 1000, 'higher')).toEqual({ delta: 500, tone: 'good', ratio: 0.5 });
    expect(variation(500, 1000, 'higher')).toEqual({ delta: -500, tone: 'bad', ratio: -0.5 });
  });

  it('is good when spending goes down', () => {
    expect(variation(800, 1000, 'lower')).toMatchObject({ delta: -200, tone: 'good' });
    expect(variation(1200, 1000, 'lower')).toMatchObject({ delta: 200, tone: 'bad' });
  });

  it('is neutral without change', () => {
    expect(variation(1000, 1000, 'higher')?.tone).toBe('neutral');
  });

  it('has no ratio when the previous value is zero or negative', () => {
    expect(variation(500, 0, 'higher')).toEqual({ delta: 500, tone: 'good', ratio: null });
    expect(variation(500, -100, 'higher')?.ratio).toBeNull();
  });

  it('is null when either value has no data', () => {
    expect(variation(null, 1000, 'higher')).toBeNull();
    expect(variation(1000, null, 'higher')).toBeNull();
  });
});

describe('spending by group and category', () => {
  const groups: Group[] = [
    { id: 'needs', name: 'Necesario', color: '#3b82f6', order: 0, createdAt: '', updatedAt: '' },
    { id: 'fun', name: 'Ocio', color: '#ec4899', order: 1, createdAt: '', updatedAt: '' },
    { id: 'empty', name: 'Vacío', color: '#78716c', order: 2, createdAt: '', updatedAt: '' },
  ];
  const categories = [
    makeCategory({ id: 'food', name: 'Comida', groupId: 'needs', order: 0 }),
    makeCategory({ id: 'rent', name: 'Alquiler', groupId: 'needs', order: 1 }),
    makeCategory({ id: 'bars', name: 'Bares', groupId: 'fun', order: 2 }),
    makeCategory({ id: 'orphan', name: 'Huérfana', groupId: 'deleted-group', order: 3 }),
    makeCategory({ id: 'salary', name: 'Nómina', type: 'income', groupId: null, order: 4 }),
  ];
  const items = [
    tx({ categoryId: 'food', amount: 3000, date: '2026-10-07', accountId: 'edenred' }),
    tx({ categoryId: 'rent', amount: 70000, date: '2026-10-01', ...recurring }),
    tx({ categoryId: 'bars', amount: 4500, date: '2026-10-08' }),
    tx({ categoryId: 'orphan', amount: 1000, date: '2026-10-09' }),
    tx({ categoryId: 'salary', type: 'income', amount: 250000, date: '2026-10-25' }),
    tx({ categoryId: 'food', amount: 9999, date: '2026-09-15' }),
  ];

  it('adds expenses of every account per group, biggest first, listing unused groups too', () => {
    const slices = expensesByGroup(items, categories, groups, october);
    expect(slices.map((s) => [s.id, s.value])).toEqual([
      ['needs', 73000],
      ['fun', 4500],
      [UNGROUPED_ID, 1000],
      ['empty', 0],
    ]);
    expect(slices[0].share).toBeCloseTo(73000 / 78500);
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1);
  });

  it('leaves recurring movements out of weeks', () => {
    const slices = expensesByGroup(items, categories, groups, thisWeek);
    expect(slices.find((s) => s.id === 'needs')?.value).toBe(3000);
  });

  it('gives zero shares when nothing was spent, keeping every group for the legend', () => {
    const slices = expensesByGroup([], categories, groups, october);
    expect(slices.map((s) => [s.id, s.value, s.share])).toEqual([
      ['needs', 0, 0],
      ['fun', 0, 0],
      ['empty', 0, 0],
    ]);
  });

  it('breaks a group down into its categories', () => {
    expect(expensesByCategory(items, categories, groups, 'needs', october).map((s) => [s.id, s.value])).toEqual([
      ['rent', 70000],
      ['food', 3000],
    ]);
    expect(expensesByCategory(items, categories, groups, UNGROUPED_ID, october).map((s) => [s.id, s.value])).toEqual([
      ['orphan', 1000],
    ]);
    expect(expensesByCategory(items, categories, groups, 'empty', october)).toEqual([]);
  });
});

describe('year to date', () => {
  const savingsIds = new Set(['bank']);

  it('compares with the same stretch of last year, savings accounts only', () => {
    const items = [
      tx({ accountId: 'bank', type: 'income', amount: 250000, date: '2026-02-25' }),
      tx({ accountId: 'bank', amount: 40000, date: '2026-10-11' }),
      tx({ accountId: 'bank', amount: 99900, date: '2026-10-12' }),
      tx({ accountId: 'edenred', amount: 5000, date: '2026-03-01' }),
      tx({ accountId: 'bank', type: 'income', amount: 200000, date: '2025-05-25' }),
      tx({ accountId: 'bank', amount: 10000, date: '2025-10-11' }),
      tx({ accountId: 'bank', amount: 77700, date: '2025-10-12' }),
    ];
    const ytd = yearToDate(items, savingsIds, '2026-10-11');
    expect(ytd.range).toEqual({ start: '2026-01-01', end: '2026-10-11' });
    expect(ytd.previousRange).toEqual({ start: '2025-01-01', end: '2025-10-11' });
    expect(ytd.current).toEqual({ income: 250000, expense: 40000, net: 210000 });
    expect(ytd.previous).toEqual({ income: 200000, expense: 10000, net: 190000 });
  });

  it('counts the recurring movements of the current month in full, in both years', () => {
    const items = [
      tx({ accountId: 'bank', type: 'income', amount: 250000, date: '2026-10-25', ...recurring }),
      tx({ accountId: 'bank', type: 'income', amount: 240000, date: '2025-10-25', recurringRuleId: 'rule', recurringMonth: '2025-10' }),
    ];
    const ytd = yearToDate(items, savingsIds, '2026-10-11');
    expect(ytd.current?.income).toBe(250000);
    expect(ytd.previous?.income).toBe(240000);
  });

  it('has no data for a year without movements', () => {
    expect(yearToDate([tx({ accountId: 'bank', date: '2026-03-01' })], savingsIds, '2026-10-11').previous).toBeNull();
  });

  it('maps 29 February to 28 February', () => {
    expect(sameRangeLastYear({ start: '2028-01-01', end: '2028-02-29' })).toEqual({ start: '2027-01-01', end: '2027-02-28' });
  });
});

describe('accountFlow', () => {
  const items = [
    tx({ accountId: 'edenred', type: 'income', amount: 16000, date: '2026-10-01', ...recurring }),
    tx({ accountId: 'edenred', amount: 1200, date: '2026-10-07' }),
    tx({ accountId: 'bank', amount: 5000, date: '2026-10-07' }),
  ];

  it('returns what came in and went out of one account', () => {
    expect(accountFlow(items, 'edenred', october)).toEqual({ income: 16000, expense: 1200, net: 14800 });
  });

  it('leaves recurring top-ups out of weeks, and has no data when nothing moved', () => {
    expect(accountFlow(items, 'edenred', thisWeek)).toEqual({ income: 0, expense: 1200, net: -1200 });
    expect(accountFlow(items, 'edenred', septemberWeek)).toBeNull();
  });
});
