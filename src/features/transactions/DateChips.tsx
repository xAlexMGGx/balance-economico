import { Icon } from '../../components/Icon';
import { Chip } from '../../components/ui';
import { addDays, formatShortDate, isValidISODate } from '../../domain/dates';
import type { ISODate } from '../../domain/types';

/** Hoy / Ayer in one tap, or any other day with the system date picker. */
export function DateChips({ value, today, onChange }: { value: ISODate; today: ISODate; onChange: (date: ISODate) => void }) {
  const yesterday = addDays(today, -1);
  const isOther = value !== today && value !== yesterday;

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Fecha">
      <Chip selected={value === today} onClick={() => onChange(today)}>
        Hoy
      </Chip>
      <Chip selected={value === yesterday} onClick={() => onChange(yesterday)}>
        Ayer
      </Chip>
      {/* The native date input sits invisible on top of the chip, so a tap opens the iOS picker directly. */}
      <label
        className={`relative flex h-11 items-center gap-2 overflow-hidden rounded-full px-4 text-[15px] font-medium ${
          isOther ? 'bg-accent text-white' : 'bg-surface-2 text-fg'
        }`}
      >
        <Icon name="calendar" className="size-4" />
        {isOther ? formatShortDate(value, today) : 'Otro día'}
        <input
          type="date"
          value={value}
          onChange={(event) => {
            if (isValidISODate(event.target.value)) onChange(event.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Elegir fecha"
        />
      </label>
    </div>
  );
}
