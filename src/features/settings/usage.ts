import type { Usage } from '../../data';

/** "3 movimientos y 1 regla recurrente". */
export function usageText({ transactions, rules }: Usage): string {
  const parts: string[] = [];
  if (transactions) parts.push(transactions === 1 ? '1 movimiento' : `${transactions} movimientos`);
  if (rules) parts.push(rules === 1 ? '1 regla recurrente' : `${rules} reglas recurrentes`);
  return parts.join(' y ');
}
