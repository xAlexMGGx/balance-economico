import { Chip, ColorDot } from '../../components/ui';
import type { Account } from '../../domain/types';

/** Todas / one chip per account. Shared by Movimientos and Calendario. */
export function AccountFilterChips({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (accountId: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filtrar por cuenta">
      <Chip selected={value === null} onClick={() => onChange(null)}>
        Todas
      </Chip>
      {accounts.map((account) => (
        <Chip key={account.id} selected={value === account.id} onClick={() => onChange(account.id)}>
          <ColorDot color={account.color} className="size-2.5" />
          {account.name}
        </Chip>
      ))}
    </div>
  );
}
