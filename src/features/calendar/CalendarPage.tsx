import { useMemo, useState } from 'react';
import { PeriodPicker } from '../../components/PeriodPicker';
import { Page } from '../../components/ui';
import { usePeriodState } from '../../components/usePeriodState';
import { useAccounts, useCategories, useTags, useTransactions } from '../../data';
import { calendarDays, summarizeDays } from '../../domain/calendar';
import { todayISO } from '../../domain/dates';
import { formatPeriod, isInPeriod } from '../../domain/periods';
import { EMPTY_FILTER, filterTransactions } from '../../domain/transactions';
import type { ISODate } from '../../domain/types';
import { AccountFilterChips } from '../transactions/AccountFilterChips';
import { useAccountFilter } from '../transactions/AccountFilterProvider';
import { CalendarLegend } from './CalendarLegend';
import { DaySheet } from './DaySheet';
import { MonthGrid } from './MonthGrid';
import { WeekList } from './WeekList';

export function CalendarPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const transactions = useTransactions();
  const today = todayISO();
  const { period, isCurrent, shift, goToCurrent, setKind } = usePeriodState('calendarPeriod', today);
  const { accountId, setAccountId } = useAccountFilter();
  const [selectedDay, setSelectedDay] = useState<ISODate | null>(null);

  // The filter can point to an account deleted in the meantime: ignore it.
  const effectiveAccountId = accounts?.some((a) => a.id === accountId) ? accountId : null;
  const days = useMemo(() => calendarDays(period), [period]);
  const summaries = useMemo(
    () =>
      summarizeDays(
        filterTransactions(transactions ?? [], { ...EMPTY_FILTER, accountId: effectiveAccountId }),
        days[0],
        days[days.length - 1],
      ),
    [transactions, effectiveAccountId, days],
  );
  // The colour scale goes up to the biggest day of the period shown.
  const maxExpense = useMemo(
    () => Math.max(0, ...[...summaries].filter(([date]) => isInPeriod(date, period)).map(([, s]) => s.expense)),
    [summaries, period],
  );
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const tagsById = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags]);

  if (!accounts || !categories || !tags || !transactions) return null;

  return (
    <Page>
      <PeriodPicker
        kind={period.kind}
        onKindChange={setKind}
        label={formatPeriod(period, today)}
        onPrevious={() => shift(-1)}
        onNext={() => shift(1)}
        canGoNext
        onToday={isCurrent ? undefined : goToCurrent}
      />

      <div className="mt-3 mb-4">
        <AccountFilterChips accounts={accounts} value={effectiveAccountId} onChange={setAccountId} />
      </div>

      {period.kind === 'month' ? (
        <MonthGrid
          period={period}
          days={days}
          summaries={summaries}
          maxExpense={maxExpense}
          today={today}
          onSelectDay={setSelectedDay}
        />
      ) : (
        <WeekList
          days={days}
          summaries={summaries}
          maxExpense={maxExpense}
          categoriesById={categoriesById}
          today={today}
          onSelectDay={setSelectedDay}
        />
      )}
      <CalendarLegend />

      {selectedDay && (
        <DaySheet
          date={selectedDay}
          today={today}
          summary={summaries.get(selectedDay)}
          accountsById={accountsById}
          categoriesById={categoriesById}
          tagsById={tagsById}
          showAccount={effectiveAccountId === null}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </Page>
  );
}
