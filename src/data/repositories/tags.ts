import { byOrder } from '../../domain/ordering';
import { cleanName, normalizeText } from '../../domain/text';
import type { Tag } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError, nextOrder, saveOrder } from './common';

async function findByName(name: string): Promise<Tag | undefined> {
  const key = normalizeText(name);
  return (await db.tags.toArray()).find((t) => normalizeText(t.name) === key);
}

export const tagsRepo = {
  async list(): Promise<Tag[]> {
    return (await db.tags.toArray()).sort(byOrder);
  },

  /** Creates the tag, or returns the existing one with the same name (ignoring case and accents). */
  async create(rawName: string): Promise<string> {
    const name = cleanName(rawName);
    if (!name) throw new RepositoryError('El tag necesita un nombre.');
    return db.transaction('rw', db.tags, async () => {
      const existing = await findByName(name);
      if (existing) return existing.id;
      const now = nowTimestamp();
      const tag: Tag = { id: newId(), name, order: await nextOrder(db.tags), createdAt: now, updatedAt: now };
      await db.tags.add(tag);
      return tag.id;
    });
  },

  /** Ids for these names, creating the tags that do not exist yet. Keeps the order and drops duplicates. */
  async resolveNames(names: readonly string[]): Promise<string[]> {
    return db.transaction('rw', db.tags, async () => {
      const ids: string[] = [];
      for (const name of names) {
        if (!cleanName(name)) continue;
        const id = await tagsRepo.create(name);
        if (!ids.includes(id)) ids.push(id);
      }
      return ids;
    });
  },

  async rename(id: string, rawName: string): Promise<void> {
    const name = cleanName(rawName);
    if (!name) throw new RepositoryError('El tag necesita un nombre.');
    await db.transaction('rw', db.tags, async () => {
      const existing = await findByName(name);
      if (existing && existing.id !== id) throw new RepositoryError(`Ya existe un tag llamado «${existing.name}».`);
      await db.tags.update(id, { name, updatedAt: nowTimestamp() });
    });
  },

  reorder(ids: readonly string[]): Promise<void> {
    return saveOrder(db.tags, ids);
  },

  usage(id: string): Promise<number> {
    return db.transactions.where('tagIds').equals(id).count();
  },

  /** Deletes the tag and removes it from every movement and rule that had it. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.tags, db.transactions, db.recurringRules], async () => {
      const updatedAt = nowTimestamp();
      await db.transactions
        .where('tagIds')
        .equals(id)
        .modify((tx) => {
          tx.tagIds = tx.tagIds.filter((t) => t !== id);
          tx.updatedAt = updatedAt;
        });
      await db.recurringRules
        .where('tagIds')
        .equals(id)
        .modify((rule) => {
          rule.tagIds = rule.tagIds.filter((t) => t !== id);
          rule.updatedAt = updatedAt;
        });
      await db.tags.delete(id);
    });
  },
};
