import { Icon } from './Icon';
import { Segmented } from './ui';
import type { PeriodKind } from '../domain/periods';

const KIND_OPTIONS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
] as const;

interface PeriodPickerProps {
  kind: PeriodKind;
  onKindChange: (kind: PeriodKind) => void;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
  /** Shown when not on the current period, to jump back to it. */
  onToday?: () => void;
}

const arrowClass = 'flex size-11 items-center justify-center rounded-full text-fg active:bg-surface-2 disabled:opacity-25';

export function PeriodPicker({ kind, onKindChange, label, onPrevious, onNext, canGoNext, onToday }: PeriodPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <Segmented label="Periodo" value={kind} options={KIND_OPTIONS} onChange={onKindChange} />
      <div className="flex items-center justify-between">
        <button type="button" className={arrowClass} onClick={onPrevious} aria-label="Periodo anterior">
          <Icon name="back" />
        </button>
        <div className="flex min-w-0 flex-col items-center">
          <span className="truncate text-base font-semibold" aria-live="polite">
            {label}
          </span>
          {onToday && (
            <button type="button" onClick={onToday} className="-my-1 h-8 px-3 text-[13px] font-semibold text-accent">
              {kind === 'month' ? 'Ir al mes actual' : 'Ir a esta semana'}
            </button>
          )}
        </div>
        <button type="button" className={arrowClass} onClick={onNext} disabled={!canGoNext} aria-label="Periodo siguiente">
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
