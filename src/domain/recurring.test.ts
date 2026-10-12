import { describe, expect, it } from 'vitest';
import { addMonths, formatMonth, formatMonthList, isValidYearMonth } from './dates';
import { changesMovement, monthsDue, pendingMonths, transactionFromRule } from './recurring';
import type { RecurringRule, RecurringRuleDraft } from './types';

const rule: RecurringRule = {
  id: 'rule',
  type: 'income',
  amount: 245000,
  dayOfMonth: 25,
  accountId: 'bank',
  categoryId: 'salary',
  title: 'Nómina',
  tagIds: ['work'],
  startMonth: '2026-08',
  endMonth: null,
  createdAt: '',
  updatedAt: '',
};

describe('month helpers', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -22)).toBe('2024-12');
    expect(addMonths('2026-10', 15)).toBe('2028-01');
  });

  it('validates months', () => {
    expect(isValidYearMonth('2026-10')).toBe(true);
    expect(isValidYearMonth('2026-13')).toBe(false);
    expect(isValidYearMonth('2026-1')).toBe(false);
    expect(isValidYearMonth('')).toBe(false);
  });

  it('names months in Spanish', () => {
    expect(formatMonth('2026-10')).toBe('oct 2026');
    expect(formatMonth('2026-10', { long: true })).toBe('octubre 2026');
  });

  it('lists months in a sentence', () => {
    expect(formatMonthList([])).toBe('');
    expect(formatMonthList(['2026-10'])).toBe('octubre de 2026');
    expect(formatMonthList(['2026-10', '2026-09'])).toBe('septiembre y octubre de 2026');
    expect(formatMonthList(['2026-08', '2026-09', '2026-10'])).toBe('agosto, septiembre y octubre de 2026');
    expect(formatMonthList(['2025-12', '2026-01'])).toBe('diciembre de 2025 y enero de 2026');
    expect(formatMonthList(['2026-01', '2026-02', '2026-03', '2026-10'])).toBe('de enero a octubre de 2026');
    expect(formatMonthList(['2025-11', '2025-12', '2026-01', '2026-02'])).toBe('de noviembre de 2025 a febrero de 2026');
  });
});

describe('monthsDue', () => {
  it('goes from the start month to the current one, both included', () => {
    expect(monthsDue(rule, '2026-10')).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('includes the current month from its first day', () => {
    expect(monthsDue({ startMonth: '2026-10', endMonth: null }, '2026-10')).toEqual(['2026-10']);
  });

  it('stops at the end month', () => {
    expect(monthsDue({ ...rule, endMonth: '2026-09' }, '2026-10')).toEqual(['2026-08', '2026-09']);
    expect(monthsDue({ ...rule, endMonth: '2027-03' }, '2026-10')).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('is empty for rules starting in the future', () => {
    expect(monthsDue({ startMonth: '2026-11', endMonth: null }, '2026-10')).toEqual([]);
  });

  it('crosses years', () => {
    expect(monthsDue({ startMonth: '2025-11', endMonth: null }, '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('pendingMonths', () => {
  it('skips months already generated, even if their movement was later deleted', () => {
    expect(pendingMonths(rule, new Set(['2026-08', '2026-10']), '2026-10')).toEqual(['2026-09']);
    expect(pendingMonths(rule, new Set(['2026-08', '2026-09', '2026-10']), '2026-10')).toEqual([]);
  });
});

describe('transactionFromRule', () => {
  it('copies the rule into a normal movement linked to the rule and month', () => {
    expect(transactionFromRule(rule, '2026-10')).toEqual({
      type: 'income',
      amount: 245000,
      date: '2026-10-25',
      accountId: 'bank',
      categoryId: 'salary',
      title: 'Nómina',
      tagIds: ['work'],
      recurringRuleId: 'rule',
      recurringMonth: '2026-10',
    });
  });

  it('uses the last day when the month is shorter', () => {
    const endOfMonth = { ...rule, dayOfMonth: 31 };
    expect(transactionFromRule(endOfMonth, '2026-02').date).toBe('2026-02-28');
    expect(transactionFromRule(endOfMonth, '2028-02').date).toBe('2028-02-29');
    expect(transactionFromRule(endOfMonth, '2026-04').date).toBe('2026-04-30');
    expect(transactionFromRule(endOfMonth, '2026-05').date).toBe('2026-05-31');
  });

  it('does not share the tag list with the rule', () => {
    const tx = transactionFromRule(rule, '2026-10');
    tx.tagIds.push('other');
    expect(rule.tagIds).toEqual(['work']);
  });
});

describe('changesMovement', () => {
  const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = rule;
  const base: RecurringRuleDraft = draft;

  it('detects changes to what the movement looks like', () => {
    expect(changesMovement(base, { ...base, amount: 250000 })).toBe(true);
    expect(changesMovement(base, { ...base, dayOfMonth: 26 })).toBe(true);
    expect(changesMovement(base, { ...base, title: null })).toBe(true);
    expect(changesMovement(base, { ...base, tagIds: [] })).toBe(true);
  });

  it('ignores changes to the start or end month only', () => {
    expect(changesMovement(base, { ...base, startMonth: '2026-01', endMonth: '2026-12' })).toBe(false);
    expect(changesMovement(base, { ...base })).toBe(false);
  });
});
