import { isValidISODate } from '../../domain/dates';
import { sortTransactionsDesc } from '../../domain/transactions';
import type { Transaction, TransactionDraft } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError } from './common';

async function validate(draft: TransactionDraft): Promise<TransactionDraft> {
  if (!Number.isInteger(draft.amount) || draft.amount <= 0) throw new RepositoryError('El importe tiene que ser mayor que cero.');
  if (!isValidISODate(draft.date)) throw new RepositoryError('La fecha no es válida.');
  const [account, category] = await Promise.all([db.accounts.get(draft.accountId), db.categories.get(draft.categoryId)]);
  if (!account) throw new RepositoryError('Elige una cuenta.');
  if (!category) throw new RepositoryError('Elige una categoría.');
  if (category.type !== draft.type) throw new RepositoryError('La categoría no corresponde al tipo de movimiento.');
  const title = draft.title?.trim() || null;
  return { ...draft, title, tagIds: [...new Set(draft.tagIds)] };
}

export const transactionsRepo = {
  /**
   * Every movement, most recent first. Filtering happens in memory with the domain functions:
   * at personal scale it is fast, and it will keep working once records are encrypted.
   */
  async list(): Promise<Transaction[]> {
    return sortTransactionsDesc(await db.transactions.toArray());
  },

  get(id: string): Promise<Transaction | undefined> {
    return db.transactions.get(id);
  },

  async create(draft: TransactionDraft): Promise<string> {
    const valid = await validate(draft);
    const now = nowTimestamp();
    const tx: Transaction = { ...valid, id: newId(), createdAt: now, updatedAt: now };
    await db.transactions.add(tx);
    return tx.id;
  },

  async update(id: string, draft: TransactionDraft): Promise<void> {
    await db.transactions.update(id, { ...(await validate(draft)), updatedAt: nowTimestamp() });
  },

  /**
   * Deletes a movement. For generated movements the occurrence record stays, so the rule
   * does not create it again for that month.
   */
  async remove(id: string): Promise<void> {
    await db.transactions.delete(id);
  },
};
