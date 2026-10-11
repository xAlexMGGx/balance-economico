import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, ListCard, Page, selectClass } from '../../components/ui';
import { useAccounts, useCategories, useGroups, useTags, useTransactions } from '../../data';
import { formatDayHeading, todayISO } from '../../domain/dates';
import { formatCents } from '../../domain/money';
import { filterTransactions, groupByDay } from '../../domain/transactions';
import { AccountFilterChips } from './AccountFilterChips';
import { useAccountFilter } from './AccountFilterProvider';
import { TransactionRow } from './TransactionRow';
import { useTransactionSheet } from './TransactionSheetProvider';

const PAGE_SIZE = 150;

export function TransactionsPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const groups = useGroups();
  const tags = useTags();
  const transactions = useTransactions();
  const { openEdit } = useTransactionSheet();
  const { accountId, setAccountId } = useAccountFilter();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // A filter can point to something deleted in the meantime: ignore it.
  const effectiveAccountId = accounts?.some((a) => a.id === accountId) ? accountId : null;
  const effectiveCategoryId = categories?.some((c) => c.id === categoryId) ? categoryId : null;
  const effectiveTagId = tags?.some((t) => t.id === tagId) ? tagId : null;

  const filtered = useMemo(
    () =>
      filterTransactions(transactions ?? [], {
        accountId: effectiveAccountId,
        categoryId: effectiveCategoryId,
        tagId: effectiveTagId,
        search,
      }),
    [transactions, effectiveAccountId, effectiveCategoryId, effectiveTagId, search],
  );
  const days = useMemo(() => groupByDay(filtered.slice(0, limit)), [filtered, limit]);

  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const tagsById = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags]);

  if (!accounts || !categories || !groups || !tags || !transactions) return null;

  const hasExtraFilters = effectiveCategoryId !== null || effectiveTagId !== null || search !== '';
  const clearFilters = () => {
    setAccountId(null);
    setCategoryId(null);
    setTagId(null);
    setSearch('');
  };
  const today = todayISO();
  const incomeCategories = categories.filter((c) => c.type === 'income');

  return (
    <Page>
      <div className="flex flex-col gap-3">
        <AccountFilterChips accounts={accounts} value={effectiveAccountId} onChange={setAccountId} />

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <Icon name="search" className="size-5" />
          </span>
          <input
            type="search"
            className="h-11 w-full rounded-xl bg-surface px-10 text-base text-fg placeholder:text-muted outline-none focus:ring-2 focus:ring-accent [&::-webkit-search-cancel-button]:hidden"
            placeholder="Buscar por título"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            enterKeyHint="search"
            aria-label="Buscar por título"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted"
              aria-label="Borrar búsqueda"
            >
              <Icon name="close" className="size-5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="Categoría"
            value={effectiveCategoryId}
            onChange={setCategoryId}
            allLabel="Todas las categorías"
            groups={[
              ...groups.map((g) => ({
                label: g.name,
                options: categories.filter((c) => c.type === 'expense' && c.groupId === g.id),
              })),
              { label: 'Ingresos', options: incomeCategories },
            ]}
          />
          <FilterSelect
            label="Tag"
            value={effectiveTagId}
            onChange={setTagId}
            allLabel="Todos los tags"
            groups={[{ label: '', options: tags.map((t) => ({ id: t.id, name: `#${t.name}` })) }]}
          />
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState title="Todavía no hay movimientos">Pulsa el botón + para añadir el primero.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Ningún movimiento coincide">
          <button type="button" onClick={clearFilters} className="mt-2 h-11 px-4 font-semibold text-accent">
            Quitar filtros
          </button>
        </EmptyState>
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {(hasExtraFilters || effectiveAccountId) && (
            <p className="-mb-2 px-1 text-sm text-muted">
              {filtered.length === 1 ? '1 movimiento' : `${filtered.length} movimientos`}
            </p>
          )}
          {days.map((day) => {
            const net = day.income - day.expense;
            return (
              <section key={day.date}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 px-4">
                  <h2 className="text-sm font-semibold">{formatDayHeading(day.date, today)}</h2>
                  <span className="text-xs text-muted tabular-nums">{formatCents(net, { signDisplay: 'always' })}</span>
                </div>
                <ListCard>
                  {day.transactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      category={categoriesById.get(tx.categoryId)}
                      account={accountsById.get(tx.accountId)}
                      tagsById={tagsById}
                      showAccount={effectiveAccountId === null}
                      onClick={() => openEdit(tx)}
                    />
                  ))}
                </ListCard>
              </section>
            );
          })}
          {filtered.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              Mostrar más
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  groups,
}: {
  label: string;
  value: string | null;
  onChange: (id: string | null) => void;
  allLabel: string;
  groups: Array<{ label: string; options: Array<{ id: string; name: string }> }>;
}) {
  const nonEmpty = groups.filter((g) => g.options.length > 0);
  return (
    <div className="relative">
      <select
        className={`${selectClass} bg-surface ${value ? 'font-semibold text-accent' : ''}`}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        aria-label={label}
      >
        <option value="">{allLabel}</option>
        {nonEmpty.map((group) =>
          group.label ? (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))
          ),
        )}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted">
        <Icon name="chevronDown" className="size-4" />
      </span>
    </div>
  );
}
