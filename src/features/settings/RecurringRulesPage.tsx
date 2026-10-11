import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Amount, Button, CategoryIcon, EmptyState, ListCard, Page } from '../../components/ui';
import { useAccounts, useCategories, useRecurringRules, useSetting, useTags, useTransactions } from '../../data';
import { formatMonth, todayISO, toYearMonth } from '../../domain/dates';
import type { Account, Category, RecurringRule } from '../../domain/types';
import { RuleSheet } from './RuleSheet';

export function RecurringRulesPage() {
  const rules = useRecurringRules();
  const accounts = useAccounts();
  const categories = useCategories();
  const tags = useTags();
  const transactions = useTransactions();
  const lastAccountId = useSetting('lastAccountId');
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);

  const currentMonth = toYearMonth(todayISO());
  const accountsById = useMemo(() => new Map((accounts ?? []).map((a) => [a.id, a])), [accounts]);
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  if (!rules || !accounts || !categories || !tags || !transactions || lastAccountId === undefined) return null;

  // Rules that already ended go last.
  const isEnded = (rule: RecurringRule) => rule.endMonth !== null && rule.endMonth < currentMonth;
  const sorted = [...rules.filter((r) => !isEnded(r)), ...rules.filter(isEnded)];

  return (
    <Page>
      <p className="mb-4 px-1 text-sm text-muted">
        Para la nómina, el alquiler o las recargas de Edenred: cada regla crea un movimiento normal al mes, que puedes editar
        o borrar por separado.
      </p>

      {sorted.length === 0 ? (
        <EmptyState title="Aún no hay movimientos recurrentes" />
      ) : (
        <ListCard>
          {sorted.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              account={accountsById.get(rule.accountId)}
              category={categoriesById.get(rule.categoryId)}
              ended={isEnded(rule)}
              onClick={() => setEditing(rule)}
            />
          ))}
        </ListCard>
      )}
      <Button variant="plain" className="mt-2 w-full" onClick={() => setEditing('new')}>
        <Icon name="plus" className="size-5" />
        Añadir regla
      </Button>

      {editing && (
        <RuleSheet
          rule={editing === 'new' ? null : editing}
          accounts={accounts}
          categories={categories}
          tags={tags}
          transactions={transactions}
          lastAccountId={lastAccountId}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

function RuleRow({
  rule,
  account,
  category,
  ended,
  onClick,
}: {
  rule: RecurringRule;
  account: Account | undefined;
  category: Category | undefined;
  ended: boolean;
  onClick: () => void;
}) {
  const range = ended
    ? `terminó en ${formatMonth(rule.endMonth!)}`
    : rule.endMonth
      ? `${formatMonth(rule.startMonth)} – ${formatMonth(rule.endMonth)}`
      : `desde ${formatMonth(rule.startMonth)}`;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2 ${ended ? 'opacity-60' : ''}`}
      >
        <CategoryIcon icon={category?.icon ?? '❓'} color={category?.color ?? '#78716c'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{rule.title ?? category?.name ?? 'Sin categoría'}</span>
          <span className="block truncate text-[13px] text-muted">
            Día {rule.dayOfMonth} · {account?.name ?? 'Sin cuenta'}
          </span>
          <span className="block truncate text-[13px] text-muted">{range.charAt(0).toUpperCase() + range.slice(1)}</span>
        </span>
        <Amount cents={rule.amount} type={rule.type} className="shrink-0 text-[15px] font-semibold" />
      </button>
    </li>
  );
}
