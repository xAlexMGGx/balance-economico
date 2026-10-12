import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ISODate, YearMonth } from './types';

/** Weeks run Monday to Sunday (date-fns `weekStartsOn`). */
export const WEEK_STARTS_ON = 1;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of a Date object. Never goes through UTC. */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Local midnight of an ISO date. */
export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function toYearMonth(date: ISODate): YearMonth {
  return date.slice(0, 7);
}

const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidYearMonth(value: string): boolean {
  return YEAR_MONTH_RE.test(value);
}

/** The month `n` months after (or before, if negative) `month`. */
export function addMonths(month: YearMonth, n: number): YearMonth {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`;
}

/** "oct 2026", or "octubre 2026" with `long`. */
export function formatMonth(month: YearMonth, { long = false } = {}): string {
  return format(parseISODate(`${month}-01`), long ? 'MMMM yyyy' : 'MMM yyyy', { locale: es });
}

/**
 * Months in a sentence: "octubre de 2026", "septiembre y octubre de 2026",
 * "diciembre de 2025 y enero de 2026", or "de enero a octubre de 2026" for more than three.
 */
export function formatMonthList(months: readonly YearMonth[]): string {
  if (months.length === 0) return '';
  const sorted = [...months].sort();
  const name = (m: YearMonth) => format(parseISODate(`${m}-01`), 'MMMM', { locale: es });
  const year = (m: YearMonth) => m.slice(0, 4);
  const sameYear = sorted.every((m) => year(m) === year(sorted[0]));
  if (sorted.length > 3) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return sameYear
      ? `de ${name(first)} a ${name(last)} de ${year(last)}`
      : `de ${name(first)} de ${year(first)} a ${name(last)} de ${year(last)}`;
  }
  const parts = sameYear ? sorted.map(name) : sorted.map((m) => `${name(m)} de ${year(m)}`);
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  return sameYear ? `${joined} de ${year(sorted[0])}` : joined;
}

export function daysInMonth(month: YearMonth): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Day `day` of `month`, or the last day of the month when it is shorter (31 → 28/29 Feb). */
export function dateInMonth(month: YearMonth, day: number): ISODate {
  return `${month}-${pad2(Math.min(day, daysInMonth(month)))}`;
}

/** Monday of the week that contains `date`. */
export function startOfWeek(date: ISODate): ISODate {
  const weekday = parseISODate(date).getDay(); // 0 = Sunday
  const offset = (weekday - WEEK_STARTS_ON + 7) % 7;
  return addDays(date, -offset);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Full date: "Lunes, 6 de octubre", or "Viernes, 3 de enero de 2025" when it is not this year. */
export function formatLongDate(date: ISODate, today: ISODate): string {
  const pattern = date.slice(0, 4) === today.slice(0, 4) ? "EEEE, d 'de' MMMM" : "EEEE, d 'de' MMMM 'de' yyyy";
  return capitalize(format(parseISODate(date), pattern, { locale: es }));
}

/** Heading of a day in a list: "Hoy", "Ayer", "Mañana", or the full date. */
export function formatDayHeading(date: ISODate, today: ISODate): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  if (date === addDays(today, 1)) return 'Mañana';
  return formatLongDate(date, today);
}

/** Compact date for buttons: "Hoy", "Ayer", "Lun 6 oct", "Vie 3 ene 2025". */
export function formatShortDate(date: ISODate, today: ISODate): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  if (date === addDays(today, 1)) return 'Mañana';
  const pattern = date.slice(0, 4) === today.slice(0, 4) ? 'EEE d MMM' : 'EEE d MMM yyyy';
  return capitalize(format(parseISODate(date), pattern, { locale: es }));
}
