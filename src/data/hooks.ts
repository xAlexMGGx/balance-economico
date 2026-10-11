import { useLiveQuery } from 'dexie-react-hooks';
import { accountsRepo } from './repositories/accounts';
import { categoriesRepo } from './repositories/categories';
import { groupsRepo } from './repositories/groups';
import { settingsRepo, type SettingKey } from './repositories/settings';
import { tagsRepo } from './repositories/tags';
import { transactionsRepo } from './repositories/transactions';

// Reactive reads for the screens: they re-render whenever the underlying data changes.
// Each hook returns `undefined` while the first load is in progress.

export const useAccounts = () => useLiveQuery(() => accountsRepo.list(), []);
export const useGroups = () => useLiveQuery(() => groupsRepo.list(), []);
export const useCategories = () => useLiveQuery(() => categoriesRepo.list(), []);
export const useTags = () => useLiveQuery(() => tagsRepo.list(), []);
export const useTransactions = () => useLiveQuery(() => transactionsRepo.list(), []);

/** Movements and rules that use a category; `null` when no id is given. */
export const useCategoryUsage = (id: string | null) =>
  useLiveQuery(() => (id ? categoriesRepo.usage(id) : null), [id]);

/** `null` when the setting has never been saved. */
export const useSetting = <K extends SettingKey>(key: K) => useLiveQuery(() => settingsRepo.get(key), [key]);
