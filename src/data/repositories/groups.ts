import { byOrder } from '../../domain/ordering';
import { cleanName } from '../../domain/text';
import type { Group, GroupDraft } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError, nextOrder, saveOrder } from './common';

function validate(draft: GroupDraft): GroupDraft {
  const name = cleanName(draft.name);
  if (!name) throw new RepositoryError('El grupo necesita un nombre.');
  return { ...draft, name };
}

export const groupsRepo = {
  async list(): Promise<Group[]> {
    return (await db.groups.toArray()).sort(byOrder);
  },

  async create(draft: GroupDraft): Promise<string> {
    const valid = validate(draft);
    const now = nowTimestamp();
    const group: Group = { ...valid, id: newId(), order: await nextOrder(db.groups), createdAt: now, updatedAt: now };
    await db.groups.add(group);
    return group.id;
  },

  async update(id: string, draft: GroupDraft): Promise<void> {
    await db.groups.update(id, { ...validate(draft), updatedAt: nowTimestamp() });
  },

  reorder(ids: readonly string[]): Promise<void> {
    return saveOrder(db.groups, ids);
  },

  /** Number of categories in the group. */
  categoryCount(id: string): Promise<number> {
    return db.categories.where('groupId').equals(id).count();
  },

  /** Deletes the group. If it has categories, they are moved to `reassignTo` first. */
  async remove(id: string, reassignTo?: string): Promise<void> {
    await db.transaction('rw', [db.groups, db.categories], async () => {
      if ((await groupsRepo.categoryCount(id)) > 0) {
        if (!reassignTo || reassignTo === id || !(await db.groups.get(reassignTo))) {
          throw new RepositoryError('Elige otro grupo al que mover sus categorías.');
        }
        await db.categories.where('groupId').equals(id).modify({ groupId: reassignTo, updatedAt: nowTimestamp() });
      }
      await db.groups.delete(id);
    });
  },
};
