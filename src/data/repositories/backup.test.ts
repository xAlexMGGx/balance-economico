import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackup, parseBackup } from '../../domain/backup';
import { db } from '../db';
import { accountsRepo } from './accounts';
import { backupRepo } from './backup';
import { categoriesRepo } from './categories';
import { groupsRepo } from './groups';
import { recurringRepo } from './recurring';
import { settingsRepo } from './settings';
import { tagsRepo } from './tags';
import { transactionsRepo } from './transactions';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.useRealTimers();
});

async function fill() {
  const [bank] = await accountsRepo.list();
  const needs = await groupsRepo.create({ name: 'Necesario', color: '#3b82f6' });
  const food = await categoriesRepo.create({ name: 'Comida', color: '#22c55e', icon: '🛒', type: 'expense', groupId: needs });
  const salary = await categoriesRepo.create({ name: 'Nómina', color: '#10b981', icon: '💼', type: 'income', groupId: null });
  const [trip] = await tagsRepo.resolveNames(['Viaje']);
  await transactionsRepo.create({
    type: 'expense',
    amount: 1250,
    date: '2026-10-07',
    accountId: bank.id,
    categoryId: food,
    title: 'Mercadona',
    tagIds: [trip],
    recurringRuleId: null,
    recurringMonth: null,
  });
  await recurringRepo.create(
    {
      type: 'income',
      amount: 245000,
      dayOfMonth: 25,
      accountId: bank.id,
      categoryId: salary,
      title: 'Nómina',
      tagIds: [],
      startMonth: '2026-09',
      endMonth: null,
    },
    '2026-10-11',
  );
  await settingsRepo.set('lastAccountId', bank.id);
}

/** Exports, serializes and parses, like a real file would. */
async function backupFile(at = new Date('2026-10-11T16:30:00Z')) {
  const text = JSON.stringify(createBackup(await backupRepo.exportData(), at));
  const result = parseBackup(text);
  if (!result.ok) throw new Error(result.error);
  return result.backup;
}

describe('backups', () => {
  it('restore exactly what was exported, replacing whatever was there', async () => {
    await fill();
    const backup = await backupFile();

    // Start over with different data.
    await db.delete();
    await db.open();
    await accountsRepo.create({ name: 'Otra', color: '#000000', initialBalance: 0, countsForSavings: true });

    await backupRepo.replaceAll(backup.data, backup.exportedAt);
    const restored = await backupRepo.exportData();
    const { settings: restoredSettings, ...restoredTables } = restored;
    const { settings: originalSettings, ...originalTables } = backup.data;
    expect(restoredTables).toEqual(originalTables);
    expect(restoredSettings).toEqual(expect.arrayContaining(originalSettings));
    expect(await settingsRepo.get('lastBackupAt')).toBe('2026-10-11T16:30:00.000Z');
    expect((await accountsRepo.list()).map((a) => a.name)).not.toContain('Otra');
  });

  it('leave the current data untouched if the import fails halfway', async () => {
    await fill();
    const before = await backupRepo.exportData();
    const backup = await backupFile();
    // Two movements with the same id: the database refuses the second one mid-import.
    const broken = { ...backup.data, transactions: [...backup.data.transactions, backup.data.transactions[0]] };
    await expect(backupRepo.replaceAll(broken, backup.exportedAt)).rejects.toThrow();
    expect(await backupRepo.exportData()).toEqual(before);
  });

  it('generate the months an old copy is missing', async () => {
    await fill();
    const backup = await backupFile();
    const salariesIn = async () => (await transactionsRepo.list()).filter((t) => t.recurringRuleId !== null).length;
    expect(await salariesIn()).toBe(2); // September and October

    // Restored in December: November and December are generated, September and October are not duplicated.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 3, 12, 0));
    await backupRepo.replaceAll(backup.data, backup.exportedAt);
    expect(await salariesIn()).toBe(4);
  });

  it('remember when the last copy was made and when the reminder was snoozed', async () => {
    await backupRepo.markExported(new Date('2026-10-11T18:00:00Z'));
    await backupRepo.snoozeReminder('2026-10-14T18:00:00.000Z');
    expect(await settingsRepo.get('lastBackupAt')).toBe('2026-10-11T18:00:00.000Z');
    expect(await settingsRepo.get('backupReminderSnoozedUntil')).toBe('2026-10-14T18:00:00.000Z');
  });
});
