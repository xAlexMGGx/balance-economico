import { BottomSheet } from '../../components/BottomSheet';
import { Icon } from '../../components/Icon';
import { Button, ListCard } from '../../components/ui';
import type { DaySummary } from '../../domain/calendar';
import { formatLongDate } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { sortTransactionsDesc } from '../../domain/transactions';
import type { Account, Category, ISODate, Tag } from '../../domain/types';
import { TransactionRow } from '../transactions/TransactionRow';
import { useTransactionSheet } from '../transactions/TransactionSheetProvider';

interface DaySheetProps {
  date: ISODate;
  today: ISODate;
  summary: DaySummary | undefined;
  accountsById: ReadonlyMap<string, Account>;
  categoriesById: ReadonlyMap<string, Category>;
  tagsById: ReadonlyMap<string, Tag>;
  /** Hide the account of each movement when the calendar is already filtered by one. */
  showAccount: boolean;
  onClose: () => void;
}

/** Movements of one day, with a button to add another on that same day. */
export function DaySheet({ date, today, summary, accountsById, categoriesById, tagsById, showAccount, onClose }: DaySheetProps) {
  const { openNew, openEdit } = useTransactionSheet();
  const transactions = summary ? sortTransactionsDesc(summary.transactions) : [];

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={formatLongDate(date, today)}
      footer={
        <Button className="w-full" onClick={() => openNew({ date })}>
          <Icon name="plus" className="size-5" />
          Añadir movimiento
        </Button>
      }
    >
      {transactions.length === 0 ? (
        <p className="py-8 text-center text-[15px] text-muted">No hay movimientos este día.</p>
      ) : (
        <div className="pt-1">
          <p className="mb-3 flex flex-wrap justify-center gap-x-4 text-[15px]">
            {summary && summary.expense > 0 && (
              <span>
                Gastado <span className="font-semibold text-expense">{formatCents(summary.expense)}</span>
              </span>
            )}
            {summary?.hasIncome && (
              <span>
                Ingresado <span className="font-semibold text-income">{formatCents(summary.income)}</span>
              </span>
            )}
          </p>
          <div className="-mx-4 -mb-4 bg-surface-2/60 px-4 pt-3 pb-4">
            <ListCard>
              {transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  category={categoriesById.get(tx.categoryId)}
                  account={accountsById.get(tx.accountId)}
                  tagsById={tagsById}
                  showAccount={showAccount}
                  onClick={() => openEdit(tx)}
                />
              ))}
            </ListCard>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
