import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { daysSince, type BackupSummary } from '../../domain/backup';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "11 oct 2026, 18:30". */
export function formatTimestamp(timestamp: string): string {
  return format(new Date(timestamp), "d MMM yyyy, HH:mm", { locale: es });
}

/** "hoy", "ayer", "hace 9 días". */
export function formatAgo(timestamp: string, now: Date): string {
  const days = daysSince(timestamp, now) ?? 0;
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/** The main counts of some data, for confirmations: "3 cuentas, 125 movimientos y 2 reglas recurrentes". */
export function describeSummary(summary: BackupSummary): string {
  const parts = [
    plural(summary.accounts, 'cuenta', 'cuentas'),
    plural(summary.categories, 'categoría', 'categorías'),
    plural(summary.transactions, 'movimiento', 'movimientos'),
  ];
  if (summary.recurringRules > 0) parts.push(plural(summary.recurringRules, 'regla recurrente', 'reglas recurrentes'));
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}
