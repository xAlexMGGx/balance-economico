import { RecurringBadge } from '../../components/ui';
import { intensityLevel, type DaySummary } from '../../domain/calendar';
import { formatCompactEuros } from '../../domain/money';
import { isInPeriod, type Period } from '../../domain/periods';
import type { ISODate } from '../../domain/types';
import { dayAriaLabel } from './dayLabel';
import { intensityStyle } from './intensity';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface MonthGridProps {
  period: Period;
  days: ISODate[];
  summaries: ReadonlyMap<ISODate, DaySummary>;
  /** Biggest daily spending of the month, the top of the colour scale. */
  maxExpense: number;
  today: ISODate;
  onSelectDay: (date: ISODate) => void;
}

export function MonthGrid({ period, days, summaries, maxExpense, today, onSelectDay }: MonthGridProps) {
  return (
    <div className="rounded-2xl bg-surface p-1.5">
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((d) => (
          <div key={d} aria-hidden="true" className="py-1 text-center text-xs font-medium text-muted">
            {d}
          </div>
        ))}
        {days.map((date) => {
          const dayNumber = Number(date.slice(8));
          // Days of the neighbouring months only fill the grid.
          if (!isInPeriod(date, period)) {
            return (
              <div key={date} className="flex h-[3.75rem] justify-center pt-1.5 text-[13px] text-muted opacity-40" aria-hidden="true">
                {dayNumber}
              </div>
            );
          }
          const summary = summaries.get(date);
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              aria-label={dayAriaLabel(date, today, summary)}
              className="flex h-[3.75rem] min-w-0 flex-col items-stretch justify-between rounded-xl px-1 pt-1 pb-1.5 transition-transform active:scale-95"
              style={intensityStyle(intensityLevel(summary?.expense ?? 0, maxExpense))}
            >
              <span className="flex items-start justify-between">
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-[13px] ${
                    isToday ? 'bg-accent font-bold text-white' : 'font-medium'
                  }`}
                >
                  {dayNumber}
                </span>
                <span className="flex flex-col items-end gap-0.5 pt-0.5">
                  {summary?.hasIncome && <span className="size-1.5 rounded-full bg-income" />}
                  {summary?.hasRecurring && <RecurringBadge className="size-2.5" />}
                </span>
              </span>
              {summary && summary.expense > 0 && (
                <span className="truncate text-center text-[11px] leading-none font-semibold">
                  {formatCompactEuros(summary.expense)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
