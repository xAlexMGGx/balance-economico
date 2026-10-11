import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { addDays, dateInMonth, parseISODate, startOfWeek, toISODate, toYearMonth } from './dates';
import type { ISODate } from './types';

export type PeriodKind = 'week' | 'month';

/** A week (Monday to Sunday) or a calendar month. Both ends included. */
export interface Period {
  kind: PeriodKind;
  start: ISODate;
  end: ISODate;
}

export function periodContaining(kind: PeriodKind, date: ISODate): Period {
  if (kind === 'week') {
    const start = startOfWeek(date);
    return { kind, start, end: addDays(start, 6) };
  }
  const month = toYearMonth(date);
  return { kind, start: `${month}-01`, end: dateInMonth(month, 31) };
}

/** The period `steps` positions before (negative) or after (positive) this one. */
export function shiftPeriod(period: Period, steps: number): Period {
  if (period.kind === 'week') return periodContaining('week', addDays(period.start, 7 * steps));
  const start = parseISODate(period.start);
  return periodContaining('month', toISODate(new Date(start.getFullYear(), start.getMonth() + steps, 1)));
}

export const previousPeriod = (period: Period): Period => shiftPeriod(period, -1);

export function isInPeriod(date: ISODate, period: Period): boolean {
  return date >= period.start && date <= period.end;
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.kind === b.kind && a.start === b.start;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const fmt = (date: ISODate, pattern: string) => format(parseISODate(date), pattern, { locale: es });

/** "Octubre 2026" · "6 – 12 oct" · "29 sept – 5 oct" · "29 dic 2025 – 4 ene 2026". The year shows when it is not this year. */
export function formatPeriod(period: Period, today: ISODate): string {
  if (period.kind === 'month') return capitalize(fmt(period.start, 'MMMM yyyy'));
  const { start, end } = period;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const showYear = !sameYear || start.slice(0, 4) !== today.slice(0, 4);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${fmt(start, 'd')} – ${fmt(end, showYear ? 'd MMM yyyy' : 'd MMM')}`;
  }
  if (sameYear) {
    return `${fmt(start, 'd MMM')} – ${fmt(end, showYear ? 'd MMM yyyy' : 'd MMM')}`;
  }
  return `${fmt(start, 'd MMM yyyy')} – ${fmt(end, 'd MMM yyyy')}`;
}

/** Name of the previous period for comparisons: "vs septiembre" / "vs semana anterior". */
export function formatComparisonLabel(period: Period): string {
  return period.kind === 'month' ? `vs ${fmt(previousPeriod(period).start, 'MMMM')}` : 'vs semana anterior';
}
