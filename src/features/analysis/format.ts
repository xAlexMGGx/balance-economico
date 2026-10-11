import type { Variation } from '../../domain/analytics';
import { formatCents, formatPercent } from '../../domain/money';

/** Green when positive, red when negative (savings, balances). */
export function signClass(value: number | null): string {
  if (value === null) return 'text-muted';
  if (value > 0) return 'text-income';
  if (value < 0) return 'text-expense';
  return 'text-fg';
}

/** Money delta, with the relative change when it makes sense: "+120,00 € (+5,2 %)". */
export function formatMoneyDelta(variation: Variation, { withRatio = false } = {}): string {
  const money = formatCents(variation.delta, { signDisplay: 'always' });
  return withRatio && variation.ratio !== null
    ? `${money} (${formatPercent(variation.ratio, { signDisplay: 'always' })})`
    : money;
}
