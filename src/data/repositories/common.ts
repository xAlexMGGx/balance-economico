import type { Dexie } from 'dexie';

/** Error whose message can be shown to the user as is. */
export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export interface Usage {
  transactions: number;
  rules: number;
}

export const isInUse = (usage: Usage) => usage.transactions > 0 || usage.rules > 0;

/** The part of a Dexie table used by the ordering helpers (accounts, groups, categories, tags). */
interface OrderedTable {
  name: string;
  db: Dexie;
  orderBy(index: 'order'): { last(): PromiseLike<{ order: number } | undefined> };
  update(id: string, changes: { order: number }): PromiseLike<number>;
}

export async function nextOrder(table: OrderedTable): Promise<number> {
  const last = await table.orderBy('order').last();
  return last ? last.order + 1 : 0;
}

/** Saves the position of each id as its `order`. */
export async function saveOrder(table: OrderedTable, ids: readonly string[]): Promise<void> {
  await table.db.transaction('rw', table.name, async () => {
    await Promise.all(ids.map((id, order) => table.update(id, { order })));
  });
}
