import type { DaySummary } from '../../domain/calendar';
import { formatLongDate } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import type { ISODate } from '../../domain/types';

/** What a screen reader announces for a day of the calendar. */
export function dayAriaLabel(date: ISODate, today: ISODate, summary: DaySummary | undefined): string {
  const parts = [formatLongDate(date, today)];
  if (date === today) parts.push('hoy');
  parts.push(summary && summary.expense > 0 ? `gastado ${formatCents(summary.expense)}` : 'sin gastos');
  if (summary?.hasIncome) parts.push(`ingresado ${formatCents(summary.income)}`);
  if (summary?.hasRecurring) parts.push('con movimientos recurrentes');
  return parts.join(', ');
}
