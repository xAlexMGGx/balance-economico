import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { accountsRepo } from './repositories/accounts';
import { backupRepo } from './repositories/backup';
import { categoriesRepo } from './repositories/categories';
import { groupsRepo } from './repositories/groups';
import { recurringRepo } from './repositories/recurring';
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
export const useRecurringRules = () => useLiveQuery(() => recurringRepo.list(), []);

/** Everything a backup would contain right now, kept up to date. */
export const useBackupData = () => useLiveQuery(() => backupRepo.exportData(), []);

/** Months already generated for a rule; `[]` for a rule not saved yet. */
export const useGeneratedMonths = (ruleId: string | null) =>
  useLiveQuery(() => (ruleId ? recurringRepo.generatedMonths(ruleId) : []), [ruleId]);

/**
 * Generates the recurring movements owed when the app opens, and again whenever it comes back
 * to the foreground (an app left open can cross into a new month).
 */
export function useRecurringGeneration(): void {
  useEffect(() => {
    const run = () => {
      recurringRepo.generateDue().catch((error: unknown) => console.error('Recurring generation failed', error));
    };
    run();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}

/** Movements and rules that use a category; `null` when no id is given. */
export const useCategoryUsage = (id: string | null) =>
  useLiveQuery(() => (id ? categoriesRepo.usage(id) : null), [id]);

/** `null` when the setting has never been saved. */
export const useSetting = <K extends SettingKey>(key: K) => useLiveQuery(() => settingsRepo.get(key), [key]);
