import { beforeEach, describe, expect, it } from 'vitest';
import type { RecurringRuleDraft } from '../../domain/types';
import { db } from '../db';
import { accountsRepo } from './accounts';
import { categoriesRepo } from './categories';
import { groupsRepo } from './groups';
import { recurringRepo } from './recurring';
import { transactionsRepo } from './transactions';

const TODAY = '2026-10-11';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function setup(overrides: Partial<RecurringRuleDraft> = {}) {
  const [bank, edenred] = await accountsRepo.list();
  const needs = await groupsRepo.create({ name: 'Necesario', color: '#3b82f6' });
  const food = await categoriesRepo.create({ name: 'Comida', color: '#22c55e', icon: '🛒', type: 'expense', groupId: needs });
  const salary = await categoriesRepo.create({ name: 'Nómina', color: '#10b981', icon: '💼', type: 'income', groupId: null });
  const draft: RecurringRuleDraft = {
    type: 'income',
    amount: 245000,
    dayOfMonth: 31,
    accountId: bank.id,
    categoryId: salary,
    title: 'Nómina',
    tagIds: [],
    startMonth: '2026-08',
    endMonth: null,
    ...overrides,
  };
  return { draft, bank: bank.id, edenred: edenred.id, food, salary };
}

/** Dates of the generated movements, oldest first. */
const generatedDates = async () =>
  (await transactionsRepo.list())
    .filter((t) => t.recurringRuleId !== null)
    .map((t) => t.date)
    .sort();

const amountOf = async (month: string) => (await transactionsRepo.list()).find((t) => t.recurringMonth === month)?.amount;

describe('generation', () => {
  it('creates the movements of past months and of the current month as soon as the rule is saved', async () => {
    const { draft } = await setup();
    const id = await recurringRepo.create(draft, TODAY);
    // Day 31 falls on the last day of shorter months. October's movement exists from the 1st
    // although it is dated the 31st.
    expect(await generatedDates()).toEqual(['2026-08-31', '2026-09-30', '2026-10-31']);
    expect(await recurringRepo.generatedMonths(id)).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(await recurringRepo.currentMonthTransaction(id, TODAY)).toMatchObject({
      amount: 245000,
      title: 'Nómina',
      recurringRuleId: id,
      recurringMonth: '2026-10',
    });
  });

  it('is idempotent: one movement per rule and month', async () => {
    const { draft } = await setup();
    await recurringRepo.create(draft, TODAY);
    expect(await recurringRepo.generateDue(TODAY)).toBe(0);
    expect(await recurringRepo.generateDue('2026-10-20')).toBe(0);
    expect(await generatedDates()).toHaveLength(3);
  });

  it('survives two generations at the same time', async () => {
    const { draft } = await setup({ startMonth: '2026-10' });
    const id = await recurringRepo.create({ ...draft, startMonth: '2027-01' }, TODAY);
    await recurringRepo.update(id, draft, { today: '2026-09-01' }); // nothing due yet in September
    await Promise.all([recurringRepo.generateDue(TODAY), recurringRepo.generateDue(TODAY)]);
    expect(await generatedDates()).toEqual(['2026-10-31']);
  });

  it('generates the new month when it arrives', async () => {
    const { draft } = await setup();
    await recurringRepo.create(draft, TODAY);
    expect(await recurringRepo.generateDue('2026-11-01')).toBe(1);
    expect((await generatedDates()).at(-1)).toBe('2026-11-30');
  });

  it('does not generate a deleted movement again', async () => {
    const { draft } = await setup();
    const id = await recurringRepo.create(draft, TODAY);
    const september = (await transactionsRepo.list()).find((t) => t.recurringMonth === '2026-09')!;
    await transactionsRepo.remove(september.id);
    expect(await recurringRepo.generateDue(TODAY)).toBe(0);
    expect(await generatedDates()).toEqual(['2026-08-31', '2026-10-31']);
    expect(await recurringRepo.generatedMonths(id)).toContain('2026-09');
  });

  it('stops at the end month and waits for rules that start in the future', async () => {
    const { draft } = await setup({ endMonth: '2026-09' });
    await recurringRepo.create(draft, TODAY);
    const future = await recurringRepo.create({ ...draft, startMonth: '2026-12', endMonth: null }, TODAY);
    expect(await generatedDates()).toEqual(['2026-08-31', '2026-09-30']);
    expect(await recurringRepo.generatedMonths(future)).toEqual([]);
    await recurringRepo.generateDue('2026-12-01');
    expect(await recurringRepo.generatedMonths(future)).toEqual(['2026-12']);
  });
});

describe('editing', () => {
  it('lets a generated movement be edited without touching the rule or other months', async () => {
    const { draft } = await setup({ dayOfMonth: 25 });
    const id = await recurringRepo.create(draft, TODAY);
    const october = (await recurringRepo.currentMonthTransaction(id, TODAY))!;
    await transactionsRepo.update(october.id, { ...october, date: '2026-10-26' });
    expect(await generatedDates()).toEqual(['2026-08-25', '2026-09-25', '2026-10-26']);
    expect((await recurringRepo.get(id))?.dayOfMonth).toBe(25);
    expect(await recurringRepo.generateDue(TODAY)).toBe(0);
  });

  it('applies a rule change only to months not generated yet', async () => {
    const { draft } = await setup({ dayOfMonth: 25 });
    const id = await recurringRepo.create(draft, TODAY);
    await recurringRepo.update(id, { ...draft, amount: 250000 }, { today: TODAY });
    expect(await amountOf('2026-09')).toBe(245000);
    expect(await amountOf('2026-10')).toBe(245000);
    await recurringRepo.generateDue('2026-11-03');
    expect(await amountOf('2026-11')).toBe(250000);
  });

  it('can also apply the change to the current month, and only to it', async () => {
    const { draft } = await setup({ dayOfMonth: 25 });
    const id = await recurringRepo.create(draft, TODAY);
    await recurringRepo.update(id, { ...draft, amount: 260000, dayOfMonth: 26 }, { applyToCurrentMonth: true, today: TODAY });
    expect(await amountOf('2026-09')).toBe(245000);
    expect(await recurringRepo.currentMonthTransaction(id, TODAY)).toMatchObject({ amount: 260000, date: '2026-10-26' });
  });

  it('does nothing to the current month if its movement was deleted', async () => {
    const { draft } = await setup({ dayOfMonth: 25 });
    const id = await recurringRepo.create(draft, TODAY);
    await transactionsRepo.remove((await recurringRepo.currentMonthTransaction(id, TODAY))!.id);
    await recurringRepo.update(id, { ...draft, amount: 1 }, { applyToCurrentMonth: true, today: TODAY });
    expect(await recurringRepo.currentMonthTransaction(id, TODAY)).toBeUndefined();
    expect(await generatedDates()).toEqual(['2026-08-25', '2026-09-25']);
  });

  it('generates the months that become due when the start moves earlier', async () => {
    const { draft } = await setup({ startMonth: '2026-10' });
    const id = await recurringRepo.create(draft, TODAY);
    await recurringRepo.update(id, { ...draft, startMonth: '2026-07' }, { today: TODAY });
    expect(await recurringRepo.generatedMonths(id)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
  });
});

describe('deleting', () => {
  it('keeps the movements already generated and generates no more', async () => {
    const { draft } = await setup();
    const id = await recurringRepo.create(draft, TODAY);
    await recurringRepo.remove(id);
    expect(await recurringRepo.get(id)).toBeUndefined();
    expect(await recurringRepo.generatedMonths(id)).toEqual([]);
    expect(await generatedDates()).toHaveLength(3);
    expect(await recurringRepo.generateDue('2026-11-01')).toBe(0);
  });

  it('moves rules too when their account or category is deleted', async () => {
    const { draft, bank, edenred, salary } = await setup();
    const id = await recurringRepo.create({ ...draft, accountId: edenred }, TODAY);
    expect(await accountsRepo.usage(edenred)).toEqual({ transactions: 3, rules: 1 });
    await accountsRepo.remove(edenred, bank);
    expect((await recurringRepo.get(id))?.accountId).toBe(bank);

    const bonus = await categoriesRepo.create({ name: 'Extra', color: '#000000', icon: '💰', type: 'income', groupId: null });
    await categoriesRepo.remove(salary, bonus);
    expect((await recurringRepo.get(id))?.categoryId).toBe(bonus);
  });
});

describe('validation', () => {
  it('rejects invalid rules', async () => {
    const { draft, food } = await setup();
    await expect(recurringRepo.create({ ...draft, amount: 0 })).rejects.toThrow('importe');
    await expect(recurringRepo.create({ ...draft, dayOfMonth: 32 })).rejects.toThrow('día');
    await expect(recurringRepo.create({ ...draft, startMonth: '2026-13' })).rejects.toThrow('inicio');
    await expect(recurringRepo.create({ ...draft, startMonth: '1990-01' })).rejects.toThrow('inicio');
    await expect(recurringRepo.create({ ...draft, endMonth: '2026-07' })).rejects.toThrow('fin');
    await expect(recurringRepo.create({ ...draft, categoryId: food })).rejects.toThrow('tipo');
    expect(await recurringRepo.list()).toEqual([]);
  });
});
