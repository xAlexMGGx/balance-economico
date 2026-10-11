import { ColorDot } from '../../components/ui';
import type { Flow } from '../../domain/analytics';
import { formatCents } from '../../domain/money';
import type { Account, Cents } from '../../domain/types';
import { DASH, signClass } from './format';

/**
 * A non-savings account: real balance today, and money in vs out during the period.
 * The two bars share one scale. They are plain CSS so the empty track always shows,
 * even when nothing moved (`flow` null), as the spec asks for charts without data.
 */
export function AccountFlowCard({ account, balance, flow }: { account: Account; balance: Cents; flow: Flow | null }) {
  const rows = [
    { label: 'Ingresado', value: flow?.income ?? null, barClass: 'bg-income-mark', textClass: 'text-income' },
    { label: 'Gastado', value: flow?.expense ?? null, barClass: 'bg-expense-mark', textClass: 'text-expense' },
  ];
  const max = Math.max(flow?.income ?? 0, flow?.expense ?? 0);

  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
          <ColorDot color={account.color} />
          <span className="truncate">{account.name}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] text-muted">Saldo actual</span>
          <span className={`block text-lg leading-tight font-semibold ${balance < 0 ? signClass(balance) : 'text-fg'}`}>
            {formatCents(balance)}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[5.5rem_1fr_6rem] items-center gap-x-2">
        {rows.map((row) => {
          const width = row.value && max > 0 ? `max(${(row.value / max) * 100}%, 2px)` : '0';
          return (
            <div key={row.label} className="contents">
              <span className="flex h-8 items-center text-[13px] text-muted">{row.label}</span>
              <div className="h-3 overflow-hidden rounded-[4px] bg-track" aria-hidden="true">
                <div className={`h-full rounded-r-[4px] ${row.barClass}`} style={{ width }} />
              </div>
              <span
                className={`flex h-8 items-center justify-end text-[15px] font-medium tabular-nums ${
                  row.value ? row.textClass : 'text-muted'
                }`}
              >
                {row.value === null ? DASH : formatCents(row.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
