import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBackup, parseBackup } from '../../domain/backup';
import { db } from '../db';
import { randomBytes } from '../security/crypto';
import { keyring, LockedError } from '../security/keyring';
import { accountsRepo } from './accounts';
import { backupRepo } from './backup';
import { categoriesRepo } from './categories';
import { groupsRepo } from './groups';
import { recurringRepo } from './recurring';
import { securityRepo } from './security';
import { tagsRepo } from './tags';
import { transactionsRepo } from './transactions';

const PASSWORD = 'una contraseña larga';
const FAST = { iterations: 1000 };

beforeEach(async () => {
  keyring.reset();
  await db.delete();
  await db.open();
  await securityRepo.init();
});

async function fill() {
  const [bank, edenred] = await accountsRepo.list();
  const needs = await groupsRepo.create({ name: 'Necesario', color: '#3b82f6' });
  const food = await categoriesRepo.create({ name: 'Supermercado', color: '#22c55e', icon: '🛒', type: 'expense', groupId: needs });
  const salary = await categoriesRepo.create({ name: 'Nómina', color: '#10b981', icon: '💼', type: 'income', groupId: null });
  const [secretTag] = await tagsRepo.resolveNames(['Secreto']);
  const txId = await transactionsRepo.create({
    type: 'expense',
    amount: 4321,
    date: '2026-10-07',
    accountId: bank.id,
    categoryId: food,
    title: 'Mercadona',
    tagIds: [secretTag],
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
      startMonth: '2026-10',
      endMonth: null,
    },
    '2026-10-11',
  );
  return { bank: bank.id, edenred: edenred.id, food, salary, secretTag, txId };
}

/** What is actually stored in IndexedDB, read without the encryption layer. */
async function rawRecords(table: string): Promise<Record<string, unknown>[]> {
  const raw = new Dexie('balance-economico');
  await raw.open();
  try {
    return await raw.table(table).toArray();
  } finally {
    raw.close();
  }
}

const rawText = async (table: string) => JSON.stringify(await rawRecords(table));

describe('turning the lock on', () => {
  it('encrypts names, amounts and titles, keeping only ids, dates and order readable', async () => {
    const { bank, txId } = await fill();
    expect(await rawText('transactions')).toContain('Mercadona');

    await securityRepo.enable(PASSWORD, FAST);
    expect(keyring.status()).toBe('unlocked');

    for (const table of ['accounts', 'categories', 'tags', 'transactions', 'recurringRules']) {
      const text = await rawText(table);
      for (const secret of ['Mercadona', 'Banco', 'Supermercado', 'Secreto', 'Nómina', '4321', '245000', '🛒']) {
        expect(text, `${secret} readable in ${table}`).not.toContain(secret);
      }
    }
    const storedTx = (await rawRecords('transactions')).find((t) => t.id === txId)!;
    expect(Object.keys(storedTx).sort()).toEqual(
      ['__enc', 'accountId', 'categoryId', 'date', 'id', 'recurringMonth', 'recurringRuleId', 'tagIds'].sort(),
    );
    expect(storedTx.date).toBe('2026-10-07');
    expect(storedTx.accountId).toBe(bank);
  });

  it('keeps every screen working on top of the encrypted data', async () => {
    const { bank, edenred, secretTag, txId } = await fill();
    await securityRepo.enable(PASSWORD, FAST);

    expect((await transactionsRepo.get(txId))?.title).toBe('Mercadona');
    expect((await accountsRepo.list()).map((a) => a.name)).toContain('Banco');
    expect(await accountsRepo.usage(bank)).toEqual({ transactions: 2, rules: 1 });

    // Writes, updates by index and reassignments still work, and stay encrypted.
    await transactionsRepo.create({ ...(await transactionsRepo.get(txId))!, title: 'Lidl', amount: 999 });
    await tagsRepo.remove(secretTag);
    await accountsRepo.remove(edenred);
    expect((await transactionsRepo.list()).map((t) => t.title)).toEqual(expect.arrayContaining(['Mercadona', 'Lidl', 'Nómina']));
    expect((await transactionsRepo.get(txId))?.tagIds).toEqual([]);
    expect(await rawText('transactions')).not.toContain('Lidl');

    // Recurring generation keeps working.
    expect(await recurringRepo.generateDue('2026-11-02')).toBe(1);
  });

  it('cannot be turned on with a short password, or twice', async () => {
    await expect(securityRepo.enable('corta', FAST)).rejects.toThrow('al menos 8');
    await securityRepo.enable(PASSWORD, FAST);
    await expect(securityRepo.enable(PASSWORD, FAST)).rejects.toThrow('ya está activado');
  });
});

describe('locking and unlocking', () => {
  it('blocks every read and write of protected data while locked', async () => {
    const { bank, food } = await fill();
    await securityRepo.enable(PASSWORD, FAST);
    securityRepo.lock();
    expect(keyring.status()).toBe('locked');

    await expect(transactionsRepo.list()).rejects.toBeInstanceOf(LockedError);
    await expect(accountsRepo.list()).rejects.toBeInstanceOf(LockedError);
    await expect(
      transactionsRepo.create({
        type: 'expense',
        amount: 100,
        date: '2026-10-08',
        accountId: bank,
        categoryId: food,
        title: 'En claro',
        tagIds: [],
        recurringRuleId: null,
        recurringMonth: null,
      }),
    ).rejects.toThrow();
    expect(await rawText('transactions')).not.toContain('En claro');
  });

  it('unlocks with the right password only', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    securityRepo.lock();
    expect(await securityRepo.unlockWithPassword('otra contraseña')).toBe(false);
    expect(keyring.status()).toBe('locked');
    expect(await securityRepo.unlockWithPassword(PASSWORD)).toBe(true);
    expect((await transactionsRepo.list()).length).toBe(2);
  });

  it('starts locked when the app opens with the lock on', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    keyring.reset(); // the app is closed and opened again
    await securityRepo.init();
    expect(keyring.status()).toBe('locked');
  });
});

describe('Face ID', () => {
  it('unlocks with the passkey secret and nothing else', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    const secret = randomBytes(32);
    await securityRepo.saveFaceIdSecret(randomBytes(16), randomBytes(32), secret);
    expect(await securityRepo.hasFaceId()).toBe(true);

    securityRepo.lock();
    expect(await securityRepo.unlockWithPrfSecret(randomBytes(32))).toBe(false);
    expect(await securityRepo.unlockWithPrfSecret(secret)).toBe(true);
    expect((await accountsRepo.list()).length).toBe(3);

    await securityRepo.disableFaceId();
    securityRepo.lock();
    expect(await securityRepo.unlockWithPrfSecret(secret)).toBe(false);
  });

  it('can only be set up while unlocked', async () => {
    await securityRepo.enable(PASSWORD, FAST);
    securityRepo.lock();
    await expect(securityRepo.saveFaceIdSecret(randomBytes(16), randomBytes(32), randomBytes(32))).rejects.toThrow('Desbloquea');
  });
});

describe('changing the password and turning the lock off', () => {
  it('changes the password without touching the data', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    const before = await rawText('transactions');
    await expect(securityRepo.changePassword('mal', 'nueva contraseña')).rejects.toThrow('actual no es correcta');
    await securityRepo.changePassword(PASSWORD, 'nueva contraseña');
    expect(await rawText('transactions')).toBe(before);

    securityRepo.lock();
    expect(await securityRepo.unlockWithPassword(PASSWORD)).toBe(false);
    expect(await securityRepo.unlockWithPassword('nueva contraseña')).toBe(true);
  });

  it('decrypts everything again when the lock is turned off', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    await expect(securityRepo.disable('mal')).rejects.toThrow('no es correcta');
    await securityRepo.disable(PASSWORD);
    expect(keyring.status()).toBe('disabled');
    expect(await rawText('transactions')).toContain('Mercadona');
    expect(await rawRecords('security')).toEqual([]);
    expect((await transactionsRepo.list()).length).toBe(2);
  });
});

describe('backups with the lock on', () => {
  it('export readable data and import it encrypted', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    const text = JSON.stringify(createBackup(await backupRepo.exportData(), new Date()));
    expect(text).toContain('Mercadona');

    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    await backupRepo.replaceAll(parsed.backup.data, parsed.backup.exportedAt);
    expect(await rawText('transactions')).not.toContain('Mercadona');
    expect((await transactionsRepo.list()).map((t) => t.title)).toContain('Mercadona');
    expect(keyring.status()).toBe('unlocked');
  });
});

describe('erasing everything', () => {
  it('deletes all data and the lock', async () => {
    await fill();
    await securityRepo.enable(PASSWORD, FAST);
    securityRepo.lock();
    await securityRepo.eraseEverything();
    keyring.reset();
    await db.open();
    await securityRepo.init();
    expect(keyring.status()).toBe('disabled');
    expect((await accountsRepo.list()).map((a) => a.name)).toEqual(['Banco', 'Edenred Restaurante', 'Edenred Transporte']);
    expect(await transactionsRepo.list()).toEqual([]);
  });
});
