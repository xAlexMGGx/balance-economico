import { describe, expect, it } from 'vitest';
import { makeAccount, makeCategory, makeTransaction } from '../test/factories';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  createBackup,
  daysSince,
  isBackupReminderDue,
  parseBackup,
  snoozeUntil,
  summarizeBackup,
  type BackupData,
} from './backup';

const META = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

function sampleData(): BackupData {
  return {
    accounts: [makeAccount({ id: 'bank', name: 'Banco' })],
    groups: [{ id: 'needs', name: 'Necesario', color: '#3b82f6', order: 0, ...META }],
    categories: [
      makeCategory({ id: 'food', groupId: 'needs' }),
      makeCategory({ id: 'salary', type: 'income', groupId: null }),
    ],
    tags: [{ id: 'trip', name: 'Viaje', order: 0, ...META }],
    transactions: [
      makeTransaction({ id: 't1', accountId: 'bank', categoryId: 'food', tagIds: ['trip'] }),
      makeTransaction({
        id: 't2',
        type: 'income',
        accountId: 'bank',
        categoryId: 'salary',
        recurringRuleId: 'rule',
        recurringMonth: '2026-10',
      }),
    ],
    recurringRules: [
      {
        id: 'rule',
        type: 'income',
        amount: 245000,
        dayOfMonth: 25,
        accountId: 'bank',
        categoryId: 'salary',
        title: 'Nómina',
        tagIds: [],
        startMonth: '2026-10',
        endMonth: null,
        ...META,
      },
    ],
    recurringOccurrences: [{ ruleId: 'rule', month: '2026-10', transactionId: 't2', createdAt: META.createdAt }],
    settings: [{ key: 'lastAccountId', value: 'bank' }],
  };
}

const text = (data: BackupData, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...createBackup(data, new Date('2026-10-11T16:30:00Z')), ...overrides });

const errorOf = (input: string) => {
  const result = parseBackup(input);
  return result.ok ? null : result.error;
};

describe('createBackup and parseBackup', () => {
  it('round-trips every table', () => {
    const data = sampleData();
    const result = parseBackup(text(data));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.data).toEqual(data);
    expect(result.backup).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: '2026-10-11T16:30:00.000Z' });
  });

  it('summarizes what the backup contains', () => {
    expect(summarizeBackup(sampleData())).toEqual({
      accounts: 1,
      groups: 1,
      categories: 2,
      tags: 1,
      transactions: 2,
      recurringRules: 1,
    });
  });

  it('names the file with the local date', () => {
    expect(backupFileName(new Date(2026, 9, 11, 23, 30))).toBe('balance-copia-2026-10-11.json');
  });

  it('rejects files that are not backups', () => {
    expect(errorOf('not json')).toMatch('no es una copia');
    expect(errorOf('{"hello":"world"}')).toMatch('no es una copia');
    expect(errorOf(text(sampleData(), { format: 'other-app' }))).toMatch('no es una copia');
    expect(errorOf(text(sampleData(), { exportedAt: 'yesterday' }))).toMatch('no es una copia');
  });

  it('asks to update the app for backups made by a newer version', () => {
    expect(errorOf(text(sampleData(), { version: BACKUP_VERSION + 1 }))).toMatch('versión más nueva');
  });

  it('says which record is wrong', () => {
    const data = sampleData();
    data.transactions[1] = { ...data.transactions[1], amount: 12.5 };
    expect(errorOf(text(data))).toBe('La copia tiene datos que no son válidos (movimiento 2: importe).');
  });

  it('checks the links between tables', () => {
    const missingAccount = sampleData();
    missingAccount.transactions[0] = { ...missingAccount.transactions[0], accountId: 'gone' };
    expect(errorOf(text(missingAccount))).toMatch('movimiento 1: cuenta');

    const wrongType = sampleData();
    wrongType.transactions[0] = { ...wrongType.transactions[0], categoryId: 'salary' };
    expect(errorOf(text(wrongType))).toMatch('movimiento 1: categoría');

    const missingGroup = sampleData();
    missingGroup.categories[0] = { ...missingGroup.categories[0], groupId: 'gone' };
    expect(errorOf(text(missingGroup))).toMatch('categoría 1: grupo');

    const missingTag = sampleData();
    missingTag.transactions[0] = { ...missingTag.transactions[0], tagIds: ['gone'] };
    expect(errorOf(text(missingTag))).toMatch('movimiento 1: tags');
  });

  it('accepts movements whose rule was deleted, and generated months whose movement was deleted', () => {
    const data = sampleData();
    data.recurringRules = [];
    data.recurringOccurrences = [];
    expect(parseBackup(text(data)).ok).toBe(true);

    const deletedMovement = sampleData();
    deletedMovement.transactions = deletedMovement.transactions.filter((t) => t.id !== 't2');
    expect(parseBackup(text(deletedMovement)).ok).toBe(true);
  });

  it('rejects repeated ids and backups without accounts', () => {
    const repeated = sampleData();
    repeated.transactions[1] = { ...repeated.transactions[1], id: 't1' };
    expect(errorOf(text(repeated))).toMatch('id repetido');

    const noAccounts = sampleData();
    noAccounts.accounts = [];
    expect(errorOf(text(noAccounts))).toMatch('ninguna cuenta');
  });
});

describe('backup reminder', () => {
  const now = new Date('2026-10-11T12:00:00Z');

  it('counts whole days', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('2026-10-11T08:00:00Z', now)).toBe(0);
    expect(daysSince('2026-10-04T11:00:00Z', now)).toBe(7);
  });

  it('reminds when there is data and no copy, or the last one is a week old', () => {
    const base = { hasData: true, snoozedUntil: null, now };
    expect(isBackupReminderDue({ ...base, lastBackupAt: null })).toBe(true);
    expect(isBackupReminderDue({ ...base, lastBackupAt: '2026-10-04T11:00:00Z' })).toBe(true);
    expect(isBackupReminderDue({ ...base, lastBackupAt: '2026-10-06T12:00:00Z' })).toBe(false);
  });

  it('stays quiet without data or while snoozed', () => {
    expect(isBackupReminderDue({ hasData: false, lastBackupAt: null, snoozedUntil: null, now })).toBe(false);
    expect(isBackupReminderDue({ hasData: true, lastBackupAt: null, snoozedUntil: snoozeUntil(now), now })).toBe(false);
    expect(isBackupReminderDue({ hasData: true, lastBackupAt: null, snoozedUntil: '2026-10-10T00:00:00Z', now })).toBe(true);
  });
});
