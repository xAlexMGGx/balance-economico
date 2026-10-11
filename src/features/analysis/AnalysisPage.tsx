import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { Page } from '../../components/ui';
import { useSessionState } from '../../components/useSessionState';
import { useAccounts, useCategories, useGroups, useTransactions } from '../../data';
import {
  type Flow,
  accountFlow,
  expensesByCategory,
  expensesByGroup,
  flowOf,
  inAccounts,
  savingsAccountIds,
  savingsSummary,
  transactionsInPeriod,
  variation,
  yearToDate,
  UNGROUPED_ID,
} from '../../domain/analytics';
import { computeAccountBalances } from '../../domain/balances';
import { isValidISODate, parseISODate, todayISO } from '../../domain/dates';
import { formatCents, formatPercent, formatPercentagePoints } from '../../domain/money';
import {
  formatComparisonLabel,
  formatPeriod,
  isSamePeriod,
  periodContaining,
  previousPeriod,
  shiftPeriod,
  type Period,
  type PeriodKind,
} from '../../domain/periods';
import type { Account, Category, Group, Transaction } from '../../domain/types';
import { AccountFlowCard } from './AccountFlowCard';
import { DeltaLine, MetricRow, SectionHeader, StatTile } from './figures';
import { formatMoneyDelta, signClass } from './format';
import { PeriodPicker } from './PeriodPicker';
import { SpendingDonut } from './SpendingDonut';

interface PeriodState {
  kind: PeriodKind;
  /** Any day inside the period shown. */
  anchor: string;
}

const isPeriodState = (value: unknown): value is PeriodState => {
  const v = value as PeriodState;
  return (v?.kind === 'week' || v?.kind === 'month') && typeof v.anchor === 'string' && isValidISODate(v.anchor);
};

const shortDate = (date: string) => format(parseISODate(date), 'd MMM', { locale: es });

export function AnalysisPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const groups = useGroups();
  const transactions = useTransactions();
  const today = todayISO();

  const [state, setState] = useSessionState<PeriodState>(
    'analysisPeriod',
    () => ({ kind: 'month', anchor: today }),
    isPeriodState,
  );
  const period = useMemo(() => periodContaining(state.kind, state.anchor), [state.kind, state.anchor]);
  const currentPeriod = periodContaining(state.kind, today);
  const isCurrent = isSamePeriod(period, currentPeriod);
  const canGoNext = period.start < currentPeriod.start;

  if (!accounts || !categories || !groups || !transactions) return null;

  const changeKind = (kind: PeriodKind) => {
    // Keep looking at the same moment: the last day of what was shown, but never past today.
    const end = period.end < today ? period.end : today;
    setState({ kind, anchor: end });
  };

  return (
    <Page>
      <PeriodPicker
        kind={state.kind}
        onKindChange={changeKind}
        label={formatPeriod(period, today)}
        onPrevious={() => setState({ kind: state.kind, anchor: shiftPeriod(period, -1).start })}
        onNext={() => canGoNext && setState({ kind: state.kind, anchor: shiftPeriod(period, 1).start })}
        canGoNext={canGoNext}
        onToday={isCurrent ? undefined : () => setState({ kind: state.kind, anchor: today })}
      />

      {transactions.length === 0 && (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
          Aún no hay movimientos. Añade el primero con el botón + y aquí verás tu ahorro y tus gastos.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-7">
        {period.kind === 'month' ? (
          <SavingsSection transactions={transactions} accounts={accounts} period={period} />
        ) : (
          <WeekBalanceSection transactions={transactions} accounts={accounts} period={period} />
        )}
        <SpendingSection transactions={transactions} categories={categories} groups={groups} period={period} />
        {period.kind === 'month' && <YearToDateSection transactions={transactions} accounts={accounts} today={today} />}
        <OtherAccountsSection transactions={transactions} accounts={accounts} period={period} today={today} />
      </div>
    </Page>
  );
}

interface SectionProps {
  transactions: Transaction[];
  accounts: Account[];
  period: Period;
}

function savingsCaption(accounts: Account[]): string {
  const names = accounts.filter((a) => a.countsForSavings).map((a) => a.name);
  return names.length > 0
    ? `Cuentas para ahorro: ${names.join(', ')}`
    : 'No hay ninguna cuenta para ahorro. Márcala en Ajustes › Cuentas.';
}

function SavingsSection({ transactions, accounts, period }: SectionProps) {
  const savingsIds = useMemo(() => savingsAccountIds(accounts), [accounts]);
  const current = savingsSummary(transactions, savingsIds, period);
  const previous = savingsSummary(transactions, savingsIds, previousPeriod(period));
  const caption = formatComparisonLabel(period);

  return (
    <section>
      <SectionHeader title="Ahorro" caption={savingsCaption(accounts)} />
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="Ahorro total"
          value={current.savings === null ? null : formatCents(current.savings)}
          valueClass={signClass(current.savings)}
          delta={
            <DeltaLine
              variation={variation(current.savings, previous.savings, 'higher')}
              format={(v) => formatMoneyDelta(v)}
              caption={caption}
            />
          }
        />
        <StatTile
          label="Tasa de ahorro"
          value={current.rate === null ? null : formatPercent(current.rate)}
          valueClass={signClass(current.rate)}
          delta={
            <DeltaLine
              variation={variation(current.rate, previous.rate, 'higher')}
              format={(v) => formatPercentagePoints(v.delta)}
              caption={caption}
            />
          }
        />
      </div>
    </section>
  );
}

function WeekBalanceSection({ transactions, accounts, period }: SectionProps) {
  const savingsIds = useMemo(() => savingsAccountIds(accounts), [accounts]);
  const flowIn = (p: Period) => flowOf(inAccounts(transactionsInPeriod(transactions, p), savingsIds));
  return (
    <section>
      <SectionHeader title="Balance de la semana" caption={`${savingsCaption(accounts)} · sin movimientos recurrentes`} />
      <FlowComparison
        current={flowIn(period)}
        previous={flowIn(previousPeriod(period))}
        previousLabel="Semana anterior"
        netLabel="Balance"
      />
    </section>
  );
}

const FLOW_ROWS = [
  { key: 'income', label: 'Ingresos', better: 'higher' },
  { key: 'expense', label: 'Gastos', better: 'lower' },
  { key: 'net', label: '', better: 'higher' },
] as const;

/** Income, expenses and their difference, each compared with an earlier stretch. */
function FlowComparison({
  current,
  previous,
  previousLabel,
  netLabel,
}: {
  current: Flow | null;
  previous: Flow | null;
  previousLabel: string;
  netLabel: string;
}) {
  return (
    <ul className="rounded-2xl bg-surface p-4">
      {FLOW_ROWS.map((row) => {
        const value = current ? current[row.key] : null;
        const before = previous ? previous[row.key] : null;
        const valueClass = row.key === 'income' ? 'text-income' : row.key === 'expense' ? 'text-expense' : signClass(value);
        return (
          <MetricRow
            key={row.key}
            label={row.key === 'net' ? netLabel : row.label}
            value={value}
            valueClass={valueClass}
            previous={before}
            previousLabel={previousLabel}
            variation={variation(value, before, row.better)}
            formatDelta={(v) => formatMoneyDelta(v, { withRatio: row.key !== 'net' })}
          />
        );
      })}
    </ul>
  );
}

function SpendingSection({
  transactions,
  categories,
  groups,
  period,
}: {
  transactions: Transaction[];
  categories: Category[];
  groups: Group[];
  period: Period;
}) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const groupSlices = useMemo(() => expensesByGroup(transactions, categories, groups, period), [transactions, categories, groups, period]);
  // A drilled group may have been deleted, or "Sin grupo" may have emptied: go back to the groups.
  const drilled = groupSlices.find((s) => s.id === groupId && (s.id !== UNGROUPED_ID || s.value > 0));
  const categorySlices = useMemo(
    () => (drilled ? expensesByCategory(transactions, categories, groups, drilled.id, period) : []),
    [drilled, transactions, categories, groups, period],
  );

  return (
    <section>
      <SectionHeader
        title="Gasto por grupos"
        caption={period.kind === 'week' ? 'Todas las cuentas · sin movimientos recurrentes' : 'Todas las cuentas'}
      />
      {drilled ? (
        <SpendingDonut
          slices={categorySlices}
          drilledInto={{ name: drilled.name, color: drilled.color, onBack: () => setGroupId(null) }}
          emptyHint="Este grupo no tiene categorías."
        />
      ) : (
        <SpendingDonut
          slices={groupSlices}
          onSelect={setGroupId}
          emptyHint="Crea grupos en Ajustes › Grupos para ver aquí en qué se va tu dinero."
        />
      )}
    </section>
  );
}

function YearToDateSection({ transactions, accounts, today }: { transactions: Transaction[]; accounts: Account[]; today: string }) {
  const ytd = useMemo(() => yearToDate(transactions, savingsAccountIds(accounts), today), [transactions, accounts, today]);
  const previousYear = ytd.previousRange.start.slice(0, 4);
  return (
    <section>
      <SectionHeader
        title="Año hasta hoy"
        caption={`${shortDate(ytd.range.start)} – ${shortDate(ytd.range.end)}, frente al mismo tramo de ${previousYear} · cuentas para ahorro`}
      />
      <FlowComparison current={ytd.current} previous={ytd.previous} previousLabel={previousYear} netLabel="Ahorro" />
    </section>
  );
}

function OtherAccountsSection({ transactions, accounts, period, today }: SectionProps & { today: string }) {
  const others = accounts.filter((a) => !a.countsForSavings);
  const balances = useMemo(() => computeAccountBalances(accounts, transactions, today), [accounts, transactions, today]);
  if (others.length === 0) return null;

  const periodText = period.kind === 'month' ? 'en el mes' : 'en la semana, sin recurrentes';
  return (
    <section>
      <SectionHeader title="Otras cuentas" caption={`Saldo real a día de hoy · ingresado y gastado ${periodText}`} />
      <div className="flex flex-col gap-3">
        {others.map((account) => (
          <AccountFlowCard
            key={account.id}
            account={account}
            balance={balances.get(account.id) ?? account.initialBalance}
            flow={accountFlow(transactions, account.id, period)}
          />
        ))}
      </div>
    </section>
  );
}
