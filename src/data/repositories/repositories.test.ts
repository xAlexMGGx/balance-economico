import { beforeEach, describe, expect, it } from 'vitest';
import type { TransactionDraft } from '../../domain/types';
import { db } from '../db';
import { accountsRepo } from './accounts';
import { categoriesRepo } from './categories';
import { groupsRepo } from './groups';
import { settingsRepo } from './settings';
import { tagsRepo } from './tags';
import { transactionsRepo } from './transactions';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

async function setup() {
  const [bank, edenred] = await accountsRepo.list();
  const needs = await groupsRepo.create({ name: 'Necesario', color: '#3b82f6' });
  const fun = await groupsRepo.create({ name: 'Ocio', color: '#ec4899' });
  const food = await categoriesRepo.create({ name: 'Comida', color: '#22c55e', icon: '🛒', type: 'expense', groupId: needs });
  const bars = await categoriesRepo.create({ name: 'Bares', color: '#f97316', icon: '🍺', type: 'expense', groupId: fun });
  const salary = await categoriesRepo.create({ name: 'Nómina', color: '#10b981', icon: '💼', type: 'income', groupId: null });
  return { bank: bank.id, edenred: edenred.id, needs, fun, food, bars, salary };
}

function draft(overrides: Partial<TransactionDraft> & Pick<TransactionDraft, 'accountId' | 'categoryId'>): TransactionDraft {
  return {
    type: 'expense',
    amount: 1000,
    date: '2026-10-11',
    title: null,
    tagIds: [],
    recurringRuleId: null,
    recurringMonth: null,
    ...overrides,
  };
}

describe('first launch', () => {
  it('creates the three default accounts, only Banco counts for savings', async () => {
    const accounts = await accountsRepo.list();
    expect(accounts.map((a) => [a.name, a.countsForSavings, a.initialBalance])).toEqual([
      ['Banco', true, 0],
      ['Edenred Restaurante', false, 0],
      ['Edenred Transporte', false, 0],
    ]);
  });

  it('starts without groups, categories or tags', async () => {
    expect(await groupsRepo.list()).toEqual([]);
    expect(await categoriesRepo.list()).toEqual([]);
    expect(await tagsRepo.list()).toEqual([]);
  });
});

describe('accounts', () => {
  it('creates, edits and reorders', async () => {
    const id = await accountsRepo.create({ name: '  Revolut ', color: '#000000', initialBalance: -1500, countsForSavings: true });
    expect((await accountsRepo.get(id))?.name).toBe('Revolut');
    await accountsRepo.update(id, { name: 'Revolut', color: '#111111', initialBalance: 2000, countsForSavings: false });
    expect(await accountsRepo.get(id)).toMatchObject({ color: '#111111', initialBalance: 2000, countsForSavings: false, order: 3 });

    const ids = (await accountsRepo.list()).map((a) => a.id);
    await accountsRepo.reorder([id, ...ids.filter((x) => x !== id)]);
    expect((await accountsRepo.list())[0].id).toBe(id);
  });

  it('rejects an empty name', async () => {
    await expect(accountsRepo.create({ name: '  ', color: '#000', initialBalance: 0, countsForSavings: false })).rejects.toThrow(
      'nombre',
    );
  });

  it('deletes an unused account', async () => {
    const { edenred } = await setup();
    await accountsRepo.remove(edenred);
    expect(await accountsRepo.get(edenred)).toBeUndefined();
  });

  it('requires a target before deleting an account with movements, then moves them', async () => {
    const { bank, edenred, food } = await setup();
    const txId = await transactionsRepo.create(draft({ accountId: edenred, categoryId: food }));
    expect(await accountsRepo.usage(edenred)).toEqual({ transactions: 1, rules: 0 });

    await expect(accountsRepo.remove(edenred)).rejects.toThrow('Elige otra cuenta');
    expect(await accountsRepo.get(edenred)).toBeDefined();

    await accountsRepo.remove(edenred, bank);
    expect(await accountsRepo.get(edenred)).toBeUndefined();
    expect((await transactionsRepo.get(txId))?.accountId).toBe(bank);
  });

  it('keeps at least one account', async () => {
    const accounts = await accountsRepo.list();
    await accountsRepo.remove(accounts[1].id);
    await accountsRepo.remove(accounts[2].id);
    await expect(accountsRepo.remove(accounts[0].id)).rejects.toThrow('al menos una cuenta');
  });
});

describe('groups', () => {
  it('moves categories to another group before deleting', async () => {
    const { needs, fun, food } = await setup();
    expect(await groupsRepo.categoryCount(needs)).toBe(1);
    await expect(groupsRepo.remove(needs)).rejects.toThrow('Elige otro grupo');
    await groupsRepo.remove(needs, fun);
    expect((await groupsRepo.list()).map((g) => g.id)).toEqual([fun]);
    expect((await categoriesRepo.list()).find((c) => c.id === food)?.groupId).toBe(fun);
  });
});

describe('categories', () => {
  it('requires a group for expenses and drops it for income', async () => {
    const { needs } = await setup();
    await expect(
      categoriesRepo.create({ name: 'Sin grupo', color: '#000', icon: '❓', type: 'expense', groupId: null }),
    ).rejects.toThrow('grupo');
    const id = await categoriesRepo.create({ name: 'Regalos', color: '#000', icon: '🎁', type: 'income', groupId: needs });
    expect((await categoriesRepo.list()).find((c) => c.id === id)?.groupId).toBeNull();
  });

  it('only allows changing the type while unused', async () => {
    const { bank, food, bars } = await setup();
    await transactionsRepo.create(draft({ accountId: bank, categoryId: food }));
    await expect(
      categoriesRepo.update(food, { name: 'Comida', color: '#000', icon: '🛒', type: 'income', groupId: null }),
    ).rejects.toThrow('tipo');
    await categoriesRepo.update(bars, { name: 'Bares', color: '#000', icon: '🍺', type: 'income', groupId: null });
    expect((await categoriesRepo.list()).find((c) => c.id === bars)?.type).toBe('income');
  });

  it('moves movements to a category of the same type before deleting', async () => {
    const { bank, food, bars, salary } = await setup();
    const txId = await transactionsRepo.create(draft({ accountId: bank, categoryId: food }));
    await expect(categoriesRepo.remove(food)).rejects.toThrow('Elige otra categoría');
    await expect(categoriesRepo.remove(food, salary)).rejects.toThrow('mismo tipo');
    await categoriesRepo.remove(food, bars);
    expect((await transactionsRepo.get(txId))?.categoryId).toBe(bars);
    expect((await categoriesRepo.list()).some((c) => c.id === food)).toBe(false);
  });
});

describe('tags', () => {
  it('reuses existing tags ignoring case and accents', async () => {
    const first = await tagsRepo.create('Viaje');
    expect(await tagsRepo.create(' viaje ')).toBe(first);
    const ids = await tagsRepo.resolveNames(['VIAJE', 'Japón', 'japon', '']);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(first);
    expect((await tagsRepo.list()).map((t) => t.name)).toEqual(['Viaje', 'Japón']);
  });

  it('does not rename to an existing name', async () => {
    await tagsRepo.create('Casa');
    const trip = await tagsRepo.create('Viaje');
    await expect(tagsRepo.rename(trip, 'casa')).rejects.toThrow('Ya existe');
    await tagsRepo.rename(trip, 'Viajes');
    expect((await tagsRepo.list()).map((t) => t.name)).toEqual(['Casa', 'Viajes']);
  });

  it('removes a deleted tag from its movements', async () => {
    const { bank, food } = await setup();
    const [home, trip] = await tagsRepo.resolveNames(['Casa', 'Viaje']);
    const txId = await transactionsRepo.create(draft({ accountId: bank, categoryId: food, tagIds: [home, trip] }));
    expect(await tagsRepo.usage(trip)).toBe(1);
    await tagsRepo.remove(trip);
    expect((await transactionsRepo.get(txId))?.tagIds).toEqual([home]);
    expect(await tagsRepo.usage(trip)).toBe(0);
  });
});

describe('transactions', () => {
  it('creates, lists newest first, updates and deletes', async () => {
    const { bank, food, salary } = await setup();
    const older = await transactionsRepo.create(draft({ accountId: bank, categoryId: food, date: '2026-10-01', title: '  Mercadona ' }));
    const newer = await transactionsRepo.create(
      draft({ accountId: bank, categoryId: salary, type: 'income', amount: 250000, date: '2026-10-05', title: '' }),
    );
    expect((await transactionsRepo.list()).map((t) => t.id)).toEqual([newer, older]);
    expect((await transactionsRepo.get(older))?.title).toBe('Mercadona');
    expect((await transactionsRepo.get(newer))?.title).toBeNull();

    await transactionsRepo.update(older, draft({ accountId: bank, categoryId: food, date: '2026-10-07', amount: 1234 }));
    expect(await transactionsRepo.get(older)).toMatchObject({ date: '2026-10-07', amount: 1234 });

    await transactionsRepo.remove(older);
    expect(await transactionsRepo.get(older)).toBeUndefined();
  });

  it('validates amount, date, account and category type', async () => {
    const { bank, food, salary } = await setup();
    await expect(transactionsRepo.create(draft({ accountId: bank, categoryId: food, amount: 0 }))).rejects.toThrow('importe');
    await expect(transactionsRepo.create(draft({ accountId: bank, categoryId: food, amount: 10.5 }))).rejects.toThrow('importe');
    await expect(transactionsRepo.create(draft({ accountId: bank, categoryId: food, date: '2026-02-30' }))).rejects.toThrow('fecha');
    await expect(transactionsRepo.create(draft({ accountId: 'nope', categoryId: food }))).rejects.toThrow('cuenta');
    await expect(transactionsRepo.create(draft({ accountId: bank, categoryId: salary }))).rejects.toThrow('tipo');
  });
});

describe('settings', () => {
  it('returns null until saved', async () => {
    expect(await settingsRepo.get('lastAccountId')).toBeNull();
    await settingsRepo.set('lastAccountId', 'abc');
    expect(await settingsRepo.get('lastAccountId')).toBe('abc');
  });
});
