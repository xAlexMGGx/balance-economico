import { addDays, startOfWeek } from './dates';
import type { Period } from './periods';
import type { Cents, ISODate, Transaction } from './types';

/** Days shown for a period: whole weeks (Monday to Sunday) covering it. */
export function calendarDays(period: Period): ISODate[] {
  const days: ISODate[] = [];
  const last = addDays(startOfWeek(period.end), 6);
  for (let day = startOfWeek(period.start); day <= last; day = addDays(day, 1)) days.push(day);
  return days;
}

export interface DaySummary {
  expense: Cents;
  income: Cents;
  transactions: Transaction[];
  hasIncome: boolean;
  hasRecurring: boolean;
}

/**
 * What happened each day between `from` and `to` (inclusive). Days without movements are absent.
 * Recurring movements appear on their own date like any other movement.
 */
export function summarizeDays(txs: readonly Transaction[], from: ISODate, to: ISODate): Map<ISODate, DaySummary> {
  const days = new Map<ISODate, DaySummary>();
  for (const tx of txs) {
    if (tx.date < from || tx.date > to) continue;
    let day = days.get(tx.date);
    if (!day) {
      day = { expense: 0, income: 0, transactions: [], hasIncome: false, hasRecurring: false };
      days.set(tx.date, day);
    }
    day.transactions.push(tx);
    if (tx.type === 'income') {
      day.income += tx.amount;
      day.hasIncome = true;
    } else {
      day.expense += tx.amount;
    }
    if (tx.recurringRuleId !== null) day.hasRecurring = true;
  }
  return days;
}

export const INTENSITY_LEVELS = 4;

/**
 * Colour step (0 = nothing spent, 1–4) for a day's spending, relative to the biggest day shown.
 * A square-root scale, so one large payment (the rent) does not wash out every other day.
 */
export function intensityLevel(value: Cents, max: Cents, levels = INTENSITY_LEVELS): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(levels, Math.max(1, Math.ceil(Math.sqrt(value / max) * levels)));
}
