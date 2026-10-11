import { cleanName } from '../../domain/text';
import type { CategoryDraft, TxType } from '../../domain/types';

export const TYPE_OPTIONS = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
] as const satisfies ReadonlyArray<{ value: TxType; label: string }>;

export function isCategoryDraftValid(draft: CategoryDraft): boolean {
  return cleanName(draft.name) !== '' && draft.icon !== '' && (draft.type === 'income' || draft.groupId !== null);
}
