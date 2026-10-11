import { describe, expect, it } from 'vitest';
import { makeTransaction as tx } from '../test/factories';
import { calendarDays, intensityLevel, summarizeDays } from './calendar';
import { periodContaining } from './periods';

describe('calendarDays', () => {
  it('covers the month with whole Monday-to-Sunday weeks', () => {
    const days = calendarDays(periodContaining('month', '2026-10-11'));
    expect(days[0]).toBe('2026-09-28');
    expect(days[days.length - 1]).toBe('2026-11-01');
    expect(days).toHaveLength(35);
    expect(days).toContain('2026-10-31');
  });

  it('needs no padding when the month starts on Monday and ends on Sunday', () => {
    const days = calendarDays(periodContaining('month', '2027-02-10'));
    expect([days[0], days[days.length - 1], days.length]).toEqual(['2027-02-01', '2027-02-28', 28]);
  });

  it('can span six weeks', () => {
    expect(calendarDays(periodContaining('month', '2026-03-15'))).toHaveLength(42);
  });

  it('returns the seven days of a week', () => {
    expect(calendarDays(periodContaining('week', '2026-10-11'))).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });
});

describe('summarizeDays', () => {
  const items = [
    tx({ id: 'a', date: '2026-10-07', amount: 1200 }),
    tx({ id: 'b', date: '2026-10-07', amount: 300 }),
    tx({ id: 'c', date: '2026-10-07', type: 'income', amount: 5000 }),
    tx({ id: 'd', date: '2026-10-01', amount: 80000, recurringRuleId: 'rule', recurringMonth: '2026-10' }),
    tx({ id: 'e', date: '2026-09-30', amount: 999 }),
  ];

  it('adds spending and income per day, and flags income and recurring movements', () => {
    const days = summarizeDays(items, '2026-10-01', '2026-10-31');
    expect([...days.keys()].sort()).toEqual(['2026-10-01', '2026-10-07']);
    const seventh = days.get('2026-10-07')!;
    expect([seventh.expense, seventh.income, seventh.hasIncome, seventh.hasRecurring]).toEqual([1500, 5000, true, false]);
    expect(seventh.transactions.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    const first = days.get('2026-10-01')!;
    expect([first.expense, first.hasIncome, first.hasRecurring]).toEqual([80000, false, true]);
  });

  it('includes both ends of the range', () => {
    expect([...summarizeDays(items, '2026-09-30', '2026-10-01').keys()].sort()).toEqual(['2026-09-30', '2026-10-01']);
  });
});

describe('intensityLevel', () => {
  it('is 0 when nothing was spent', () => {
    expect(intensityLevel(0, 1000)).toBe(0);
    expect(intensityLevel(0, 0)).toBe(0);
  });

  it('reaches the top step on the biggest day', () => {
    expect(intensityLevel(1000, 1000)).toBe(4);
  });

  it('never shows a day with spending as empty', () => {
    expect(intensityLevel(1, 1_000_000)).toBe(1);
  });

  it('uses a square-root scale so one big payment does not flatten the rest', () => {
    // A 50 € day next to an 800 € rent: a quarter of the way up instead of barely visible.
    expect(intensityLevel(5000, 80000)).toBe(1);
    expect(intensityLevel(20000, 80000)).toBe(2);
    expect(intensityLevel(45000, 80000)).toBe(3);
    expect(intensityLevel(46000, 80000)).toBe(4);
  });
});
