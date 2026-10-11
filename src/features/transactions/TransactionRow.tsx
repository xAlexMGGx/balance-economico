import { Amount, CategoryIcon, RecurringBadge } from '../../components/ui';
import type { Account, Category, Tag, Transaction } from '../../domain/types';

interface TransactionRowProps {
  transaction: Transaction;
  category: Category | undefined;
  account: Account | undefined;
  tagsById: ReadonlyMap<string, Tag>;
  /** Hide the account name when the list is already filtered by account. */
  showAccount: boolean;
  onClick: () => void;
}

export function TransactionRow({ transaction, category, account, tagsById, showAccount, onClick }: TransactionRowProps) {
  const categoryName = category?.name ?? 'Sin categoría';
  const details = [
    transaction.title ? categoryName : null,
    showAccount ? account?.name : null,
    ...transaction.tagIds.map((id) => (tagsById.has(id) ? `#${tagsById.get(id)!.name}` : null)),
  ].filter(Boolean);

  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2">
        <CategoryIcon icon={category?.icon ?? '❓'} color={category?.color ?? '#78716c'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-medium">{transaction.title ?? categoryName}</span>
            {transaction.recurringRuleId && <RecurringBadge />}
          </span>
          {details.length > 0 && <span className="block truncate text-[13px] text-muted">{details.join(' · ')}</span>}
        </span>
        <Amount cents={transaction.amount} type={transaction.type} className="shrink-0 text-[15px] font-semibold" />
      </button>
    </li>
  );
}
