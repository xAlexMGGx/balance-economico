import { byOrder } from '../../domain/ordering';
import { cleanName } from '../../domain/text';
import type { Account, AccountDraft } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError, isInUse, nextOrder, saveOrder, type Usage } from './common';

function validate(draft: AccountDraft): AccountDraft {
  const name = cleanName(draft.name);
  if (!name) throw new RepositoryError('La cuenta necesita un nombre.');
  if (!Number.isInteger(draft.initialBalance)) throw new RepositoryError('El saldo inicial no es válido.');
  return { ...draft, name };
}

export const accountsRepo = {
  async list(): Promise<Account[]> {
    return (await db.accounts.toArray()).sort(byOrder);
  },

  get(id: string): Promise<Account | undefined> {
    return db.accounts.get(id);
  },

  async create(draft: AccountDraft): Promise<string> {
    const valid = validate(draft);
    const now = nowTimestamp();
    const account: Account = { ...valid, id: newId(), order: await nextOrder(db.accounts), createdAt: now, updatedAt: now };
    await db.accounts.add(account);
    return account.id;
  },

  async update(id: string, draft: AccountDraft): Promise<void> {
    await db.accounts.update(id, { ...validate(draft), updatedAt: nowTimestamp() });
  },

  reorder(ids: readonly string[]): Promise<void> {
    return saveOrder(db.accounts, ids);
  },

  async usage(id: string): Promise<Usage> {
    const [transactions, rules] = await Promise.all([
      db.transactions.where('accountId').equals(id).count(),
      db.recurringRules.where('accountId').equals(id).count(),
    ]);
    return { transactions, rules };
  },

  /** Deletes the account. If it has movements or rules, they are moved to `reassignTo` first. */
  async remove(id: string, reassignTo?: string): Promise<void> {
    await db.transaction('rw', [db.accounts, db.transactions, db.recurringRules], async () => {
      if ((await db.accounts.count()) <= 1) {
        throw new RepositoryError('Tiene que quedar al menos una cuenta.');
      }
      if (isInUse(await accountsRepo.usage(id))) {
        if (!reassignTo || reassignTo === id || !(await db.accounts.get(reassignTo))) {
          throw new RepositoryError('Elige otra cuenta a la que mover sus movimientos.');
        }
        const updatedAt = nowTimestamp();
        await db.transactions.where('accountId').equals(id).modify({ accountId: reassignTo, updatedAt });
        await db.recurringRules.where('accountId').equals(id).modify({ accountId: reassignTo, updatedAt });
      }
      await db.accounts.delete(id);
    });
  },
};
