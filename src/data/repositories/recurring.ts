import { isValidYearMonth, todayISO, toYearMonth } from '../../domain/dates';
import { pendingMonths, transactionFromRule, type RuleChangeScope } from '../../domain/recurring';
import type { ISODate, RecurringRule, RecurringRuleDraft, Transaction, YearMonth } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError } from './common';

/** Earliest start month accepted, to catch typos that would generate decades of movements. */
const MIN_START_MONTH = '2000-01';

async function validate(draft: RecurringRuleDraft): Promise<RecurringRuleDraft> {
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) throw new RepositoryError('El importe tiene que ser mayor que cero.');
  if (!Number.isInteger(draft.dayOfMonth) || draft.dayOfMonth < 1 || draft.dayOfMonth > 31) {
    throw new RepositoryError('El día del mes tiene que estar entre 1 y 31.');
  }
  if (!isValidYearMonth(draft.startMonth) || draft.startMonth < MIN_START_MONTH) {
    throw new RepositoryError('El mes de inicio no es válido.');
  }
  if (draft.endMonth !== null && (!isValidYearMonth(draft.endMonth) || draft.endMonth < draft.startMonth)) {
    throw new RepositoryError('El mes de fin tiene que ser igual o posterior al de inicio.');
  }
  const [account, category] = await Promise.all([db.accounts.get(draft.accountId), db.categories.get(draft.categoryId)]);
  if (!account) throw new RepositoryError('Elige una cuenta.');
  if (!category) throw new RepositoryError('Elige una categoría.');
  if (category.type !== draft.type) throw new RepositoryError('La categoría no corresponde al tipo de movimiento.');
  return { ...draft, title: draft.title?.trim() || null, tagIds: [...new Set(draft.tagIds)] };
}

const generationTables = () => [db.recurringRules, db.recurringOccurrences, db.transactions, db.accounts, db.categories];

/**
 * Creates the movements these rules still owe up to the current month. Must run inside a
 * transaction over `generationTables()`. Returns how many movements were created.
 */
async function generateFor(rules: readonly RecurringRule[], today: ISODate): Promise<number> {
  const currentMonth = toYearMonth(today);
  let created = 0;
  for (const rule of rules) {
    // Rules always point to an existing account and category (deleting one reassigns them),
    // but never create movements that would point nowhere.
    const [account, category] = await Promise.all([db.accounts.get(rule.accountId), db.categories.get(rule.categoryId)]);
    if (!account || !category) continue;

    const occurrences = await db.recurringOccurrences.where('ruleId').equals(rule.id).toArray();
    const generated = new Set(occurrences.map((o) => o.month));
    for (const month of pendingMonths(rule, generated, currentMonth)) {
      const now = nowTimestamp();
      const tx: Transaction = { ...transactionFromRule(rule, month), id: newId(), createdAt: now, updatedAt: now };
      await db.transactions.add(tx);
      // Primary key [ruleId+month]: a second attempt for the same month fails instead of duplicating.
      await db.recurringOccurrences.add({ ruleId: rule.id, month, transactionId: tx.id, createdAt: now });
      created += 1;
    }
  }
  return created;
}

function byDayThenTitle(a: RecurringRule, b: RecurringRule): number {
  return a.dayOfMonth - b.dayOfMonth || (a.title ?? '').localeCompare(b.title ?? '', 'es');
}

export const recurringRepo = {
  async list(): Promise<RecurringRule[]> {
    return (await db.recurringRules.toArray()).sort(byDayThenTitle);
  },

  get(id: string): Promise<RecurringRule | undefined> {
    return db.recurringRules.get(id);
  },

  /** Months already generated for a rule (whether or not their movement still exists). */
  async generatedMonths(ruleId: string): Promise<YearMonth[]> {
    return (await db.recurringOccurrences.where('ruleId').equals(ruleId).toArray()).map((o) => o.month).sort();
  },

  /** The current month's movement of a rule, if it was generated and has not been deleted. */
  async currentMonthTransaction(ruleId: string, today: ISODate = todayISO()): Promise<Transaction | undefined> {
    const occurrence = await db.recurringOccurrences.get([ruleId, toYearMonth(today)]);
    return occurrence ? db.transactions.get(occurrence.transactionId) : undefined;
  },

  /** Movements the rule has created that still exist, oldest month first. */
  async existingMovements(ruleId: string): Promise<Array<{ month: YearMonth; transaction: Transaction }>> {
    const occurrences = await db.recurringOccurrences.where('ruleId').equals(ruleId).toArray();
    const found = await Promise.all(
      occurrences.map(async (o) => ({ month: o.month, transaction: await db.transactions.get(o.transactionId) })),
    );
    return found
      .filter((f): f is { month: YearMonth; transaction: Transaction } => f.transaction !== undefined)
      .sort((a, b) => (a.month < b.month ? -1 : 1));
  },

  /** Creates the rule and, right away, the movements of its months up to the current one. */
  async create(draft: RecurringRuleDraft, today: ISODate = todayISO()): Promise<string> {
    const valid = await validate(draft);
    const now = nowTimestamp();
    const rule: RecurringRule = { ...valid, id: newId(), createdAt: now, updatedAt: now };
    await db.transaction('rw', generationTables(), async () => {
      await db.recurringRules.add(rule);
      await generateFor([rule], today);
    });
    return rule.id;
  },

  /**
   * Changes the rule. `applyTo` decides which movements it already created take the new values
   * (see RuleChangeScope); deleted ones are never created again. Months that become due with the
   * change (an earlier start, for example) are generated.
   */
  async update(
    id: string,
    draft: RecurringRuleDraft,
    { applyTo = 'future', today = todayISO() }: { applyTo?: RuleChangeScope; today?: ISODate } = {},
  ): Promise<void> {
    const valid = await validate(draft);
    await db.transaction('rw', generationTables(), async () => {
      const current = await db.recurringRules.get(id);
      if (!current) throw new RepositoryError('La regla ya no existe.');
      const rule: RecurringRule = { ...current, ...valid, updatedAt: nowTimestamp() };
      await db.recurringRules.put(rule);

      if (applyTo !== 'future') {
        const currentMonth = toYearMonth(today);
        for (const { month, transaction } of await recurringRepo.existingMovements(id)) {
          if (applyTo === 'currentMonth' && month !== currentMonth) continue;
          await db.transactions.update(transaction.id, { ...transactionFromRule(rule, month), updatedAt: nowTimestamp() });
        }
      }
      await generateFor([rule], today);
    });
  },

  /** Deletes the rule. Movements it already generated stay, as normal movements marked as recurring. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.recurringRules, db.recurringOccurrences], async () => {
      await db.recurringOccurrences.where('ruleId').equals(id).delete();
      await db.recurringRules.delete(id);
    });
  },

  /** Generates every movement still owed by every rule. Safe to call as often as needed. */
  async generateDue(today: ISODate = todayISO()): Promise<number> {
    return db.transaction('rw', generationTables(), async () => generateFor(await db.recurringRules.toArray(), today));
  },
};
