import { toYearMonth } from './dates';
import { isInPeriod, type Period } from './periods';
import type { Account, Category, Cents, Group, ISODate, Transaction } from './types';

// Pure calculations behind the Análisis section. A `null` result means "no data":
// the screen shows a dash instead of the number, it never hides the KPI.

/**
 * Movements that count in a period.
 * Recurring movements are monthly by nature: they count in their month from day 1
 * (they exist from the 1st even if dated later) and never count in a week, even if
 * their date falls inside it.
 */
export function transactionsInPeriod(txs: readonly Transaction[], period: Period): Transaction[] {
  return txs.filter(
    (tx) => isInPeriod(tx.date, period) && !(period.kind === 'week' && tx.recurringRuleId !== null),
  );
}

export interface DateRange {
  start: ISODate;
  end: ISODate;
}

/**
 * Movements from `start` up to `end`, plus every recurring movement of `end`'s month,
 * because the recurring movements of a month count in full from its first day.
 */
export function transactionsToDate(txs: readonly Transaction[], range: DateRange): Transaction[] {
  const endMonth = toYearMonth(range.end);
  return txs.filter(
    (tx) =>
      tx.date >= range.start &&
      (tx.date <= range.end || (tx.recurringRuleId !== null && toYearMonth(tx.date) === endMonth)),
  );
}

export function savingsAccountIds(accounts: readonly Account[]): Set<string> {
  return new Set(accounts.filter((a) => a.countsForSavings).map((a) => a.id));
}

export function inAccounts(txs: readonly Transaction[], accountIds: ReadonlySet<string>): Transaction[] {
  return txs.filter((tx) => accountIds.has(tx.accountId));
}

export interface Flow {
  income: Cents;
  expense: Cents;
  /** income − expense. */
  net: Cents;
}

/** Totals of some movements, or null when there are none. */
export function flowOf(txs: readonly Transaction[]): Flow | null {
  if (txs.length === 0) return null;
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export interface SavingsSummary {
  /** "Ahorro total": income − expenses of the savings accounts. */
  savings: Cents | null;
  /** "Tasa de ahorro": savings / income, as a ratio (0.25 = 25 %). Null without income. */
  rate: number | null;
}

export function savingsSummary(txs: readonly Transaction[], savingsIds: ReadonlySet<string>, period: Period): SavingsSummary {
  const flow = flowOf(inAccounts(transactionsInPeriod(txs, period), savingsIds));
  return {
    savings: flow ? flow.net : null,
    rate: flow && flow.income > 0 ? flow.net / flow.income : null,
  };
}

export type Tone = 'good' | 'bad' | 'neutral';

export interface Variation {
  /** current − previous, in the unit of the values. */
  delta: number;
  /** Whether the change is good for the user. */
  tone: Tone;
  /** delta / previous; null when the previous value is not positive (the ratio would be meaningless). */
  ratio: number | null;
}

/** Change between two values. `better` says which direction is good: more savings, less spending. */
export function variation(current: number | null, previous: number | null, better: 'higher' | 'lower'): Variation | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  const tone: Tone = delta === 0 ? 'neutral' : delta > 0 === (better === 'higher') ? 'good' : 'bad';
  return { delta, tone, ratio: previous > 0 ? delta / previous : null };
}

// --- Spending by group and category -------------------------------------------------

export const UNGROUPED_ID = '__ungrouped__';
const UNGROUPED_COLOR = '#8e8e93';

export interface Slice {
  id: string;
  name: string;
  color: string;
  value: Cents;
  /** Share of the total, 0–1 (0 when there is no spending at all). */
  share: number;
}

function toSlices(entries: Array<Omit<Slice, 'share'>>): Slice[] {
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  // Biggest first; equal values keep the user's order (Array.prototype.sort is stable).
  return entries
    .map((e) => ({ ...e, share: total > 0 ? e.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

function expensesInPeriod(txs: readonly Transaction[], period: Period): Transaction[] {
  return transactionsInPeriod(txs, period).filter((tx) => tx.type === 'expense');
}

/** Group a category belongs to, or UNGROUPED_ID when the category or its group is missing. */
function groupOf(categoryId: string, categoriesById: ReadonlyMap<string, Category>, groupIds: ReadonlySet<string>): string {
  const groupId = categoriesById.get(categoryId)?.groupId;
  return groupId && groupIds.has(groupId) ? groupId : UNGROUPED_ID;
}

/**
 * Expenses of the period per group, all accounts. Every group appears (with 0 if unused) so the
 * legend stays complete; "Sin grupo" only appears when something falls into it.
 */
export function expensesByGroup(
  txs: readonly Transaction[],
  categories: readonly Category[],
  groups: readonly Group[],
  period: Period,
): Slice[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const groupIds = new Set(groups.map((g) => g.id));
  const totals = new Map<string, Cents>();
  for (const tx of expensesInPeriod(txs, period)) {
    const groupId = groupOf(tx.categoryId, categoriesById, groupIds);
    totals.set(groupId, (totals.get(groupId) ?? 0) + tx.amount);
  }
  const entries = groups.map((g) => ({ id: g.id, name: g.name, color: g.color, value: totals.get(g.id) ?? 0 }));
  const ungrouped = totals.get(UNGROUPED_ID) ?? 0;
  if (ungrouped > 0) entries.push({ id: UNGROUPED_ID, name: 'Sin grupo', color: UNGROUPED_COLOR, value: ungrouped });
  return toSlices(entries);
}

/** Expenses of the period per category of one group (every category of the group appears). */
export function expensesByCategory(
  txs: readonly Transaction[],
  categories: readonly Category[],
  groups: readonly Group[],
  groupId: string,
  period: Period,
): Slice[] {
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const groupIds = new Set(groups.map((g) => g.id));
  const totals = new Map<string, Cents>();
  let unknown = 0;
  for (const tx of expensesInPeriod(txs, period)) {
    if (groupOf(tx.categoryId, categoriesById, groupIds) !== groupId) continue;
    if (categoriesById.has(tx.categoryId)) totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0) + tx.amount);
    else unknown += tx.amount;
  }
  const entries = categories
    .filter((c) => c.type === 'expense' && groupOf(c.id, categoriesById, groupIds) === groupId)
    .map((c) => ({ id: c.id, name: c.name, color: c.color, value: totals.get(c.id) ?? 0 }));
  if (unknown > 0) entries.push({ id: '__unknown__', name: 'Sin categoría', color: UNGROUPED_COLOR, value: unknown });
  return toSlices(entries);
}

// --- Year to date ----------------------------------------------------------------------

export function yearToDateRange(today: ISODate): DateRange {
  return { start: `${today.slice(0, 4)}-01-01`, end: today };
}

/** The same stretch one year earlier. 29 February becomes 28 February. */
export function sameRangeLastYear(range: DateRange): DateRange {
  const shift = (date: ISODate) => {
    const year = Number(date.slice(0, 4)) - 1;
    const monthDay = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
    return `${year}-${monthDay}`;
  };
  return { start: shift(range.start), end: shift(range.end) };
}

export interface YearToDate {
  range: DateRange;
  previousRange: DateRange;
  /** Savings accounts only, so that savings = income − expenses. */
  current: Flow | null;
  previous: Flow | null;
}

export function yearToDate(txs: readonly Transaction[], savingsIds: ReadonlySet<string>, today: ISODate): YearToDate {
  const range = yearToDateRange(today);
  const previousRange = sameRangeLastYear(range);
  const savingsTxs = inAccounts(txs, savingsIds);
  return {
    range,
    previousRange,
    current: flowOf(transactionsToDate(savingsTxs, range)),
    previous: flowOf(transactionsToDate(savingsTxs, previousRange)),
  };
}

// --- Other accounts (Edenred) ------------------------------------------------------------

/** Money in and out of one account during the period; null when nothing moved. */
export function accountFlow(txs: readonly Transaction[], accountId: string, period: Period): Flow | null {
  return flowOf(transactionsInPeriod(txs, period).filter((tx) => tx.accountId === accountId));
}
