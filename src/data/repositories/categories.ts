import { byOrder } from '../../domain/ordering';
import { cleanName } from '../../domain/text';
import type { Category, CategoryDraft } from '../../domain/types';
import { db } from '../db';
import { newId, nowTimestamp } from '../ids';
import { RepositoryError, isInUse, nextOrder, saveOrder, type Usage } from './common';

async function validate(draft: CategoryDraft): Promise<CategoryDraft> {
  const name = cleanName(draft.name);
  if (!name) throw new RepositoryError('La categoría necesita un nombre.');
  if (!draft.icon.trim()) throw new RepositoryError('Elige un icono para la categoría.');
  if (draft.type === 'income') return { ...draft, name, groupId: null };
  if (!draft.groupId || !(await db.groups.get(draft.groupId))) {
    throw new RepositoryError('Las categorías de gasto necesitan un grupo.');
  }
  return { ...draft, name };
}

export const categoriesRepo = {
  async list(): Promise<Category[]> {
    return (await db.categories.toArray()).sort(byOrder);
  },

  async create(draft: CategoryDraft): Promise<string> {
    const valid = await validate(draft);
    const now = nowTimestamp();
    const category: Category = {
      ...valid,
      id: newId(),
      order: await nextOrder(db.categories),
      createdAt: now,
      updatedAt: now,
    };
    await db.categories.add(category);
    return category.id;
  },

  async update(id: string, draft: CategoryDraft): Promise<void> {
    await db.transaction('rw', [db.categories, db.groups, db.transactions, db.recurringRules], async () => {
      const current = await db.categories.get(id);
      if (!current) throw new RepositoryError('La categoría ya no existe.');
      if (current.type !== draft.type && isInUse(await categoriesRepo.usage(id))) {
        throw new RepositoryError('No se puede cambiar el tipo de una categoría que ya tiene movimientos.');
      }
      await db.categories.update(id, { ...(await validate(draft)), updatedAt: nowTimestamp() });
    });
  },

  reorder(ids: readonly string[]): Promise<void> {
    return saveOrder(db.categories, ids);
  },

  async usage(id: string): Promise<Usage> {
    const [transactions, rules] = await Promise.all([
      db.transactions.where('categoryId').equals(id).count(),
      db.recurringRules.where('categoryId').equals(id).count(),
    ]);
    return { transactions, rules };
  },

  /** Deletes the category. If it has movements or rules, they are moved to `reassignTo` (same type) first. */
  async remove(id: string, reassignTo?: string): Promise<void> {
    await db.transaction('rw', [db.categories, db.transactions, db.recurringRules], async () => {
      const category = await db.categories.get(id);
      if (!category) return;
      if (isInUse(await categoriesRepo.usage(id))) {
        const target = reassignTo && reassignTo !== id ? await db.categories.get(reassignTo) : undefined;
        if (!target || target.type !== category.type) {
          throw new RepositoryError('Elige otra categoría del mismo tipo a la que mover sus movimientos.');
        }
        const updatedAt = nowTimestamp();
        await db.transactions.where('categoryId').equals(id).modify({ categoryId: target.id, updatedAt });
        await db.recurringRules.where('categoryId').equals(id).modify({ categoryId: target.id, updatedAt });
      }
      await db.categories.delete(id);
    });
  },
};
