import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Icon } from '../../components/Icon';
import { DASH } from '../../components/ui';
import { intensityLevel, type DaySummary } from '../../domain/calendar';
import { parseISODate } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { sortTransactionsDesc } from '../../domain/transactions';
import type { Category, ISODate } from '../../domain/types';
import { dayAriaLabel } from './dayLabel';
import { intensityStyle } from './intensity';

interface WeekListProps {
  days: ISODate[];
  summaries: ReadonlyMap<ISODate, DaySummary>;
  /** Biggest daily spending of the week, the top of the colour scale. */
  maxExpense: number;
  categoriesById: ReadonlyMap<string, Category>;
  today: ISODate;
  onSelectDay: (date: ISODate) => void;
}

/** The seven days as rows, each with what was spent and a preview of its movements. */
export function WeekList({ days, summaries, maxExpense, categoriesById, today, onSelectDay }: WeekListProps) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
      {days.map((date) => {
        const summary = summaries.get(date);
        const isToday = date === today;
        const names = summary
          ? sortTransactionsDesc(summary.transactions).map((tx) => tx.title ?? categoriesById.get(tx.categoryId)?.name ?? '')
          : [];
        return (
          <li key={date}>
            <button
              type="button"
              onClick={() => onSelectDay(date)}
              aria-label={dayAriaLabel(date, today, summary)}
              className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left active:bg-surface-2"
            >
              <span
                className={`flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none ${
                  isToday ? 'ring-2 ring-accent' : ''
                }`}
                style={intensityStyle(intensityLevel(summary?.expense ?? 0, maxExpense))}
              >
                <span className={`text-[11px] uppercase ${isToday ? 'font-bold text-accent' : 'text-muted'}`}>
                  {format(parseISODate(date), 'EEE', { locale: es })}
                </span>
                <span className="mt-1 text-lg font-semibold">{Number(date.slice(8))}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] ${names.length ? '' : 'text-muted'}`}>
                  {names.length ? names.join(' · ') : 'Sin movimientos'}
                </span>
                {summary && (summary.hasIncome || summary.hasRecurring) && (
                  <span className="mt-0.5 flex items-center gap-3 text-[13px]">
                    {summary.hasIncome && (
                      <span className="flex items-center gap-1.5 text-income">
                        <span className="size-1.5 rounded-full bg-income" />
                        {formatCents(summary.income, { signDisplay: 'always' })}
                      </span>
                    )}
                    {summary.hasRecurring && (
                      <span className="flex items-center gap-1 text-muted">
                        <Icon name="repeat" className="size-3.5" />
                        Recurrente
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-[15px] font-semibold tabular-nums ${
                  summary && summary.expense > 0 ? 'text-expense' : 'text-muted'
                }`}
              >
                {summary && summary.expense > 0 ? formatCents(-summary.expense) : DASH}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
