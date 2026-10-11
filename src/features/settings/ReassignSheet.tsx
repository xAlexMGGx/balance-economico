import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Icon } from '../../components/Icon';
import { Button, CategoryIcon, ColorDot } from '../../components/ui';
import { RepositoryError } from '../../data';

export interface ReassignOption {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface ReassignSheetProps {
  title: string;
  message: string;
  options: ReassignOption[];
  onConfirm: (targetId: string) => Promise<void>;
  onClose: () => void;
}

/** Asks where to move the movements (or categories) of something before deleting it. */
export function ReassignSheet({ title, message, options, onConfirm, onClose }: ReassignSheetProps) {
  const [target, setTarget] = useState<string | null>(options.length === 1 ? options[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await onConfirm(target);
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido borrar.');
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={title}
      footer={
        <Button variant="danger" className="w-full" disabled={!target || busy} onClick={() => void confirm()}>
          Mover y borrar
        </Button>
      }
    >
      <p className="pt-1 pb-4 text-[15px] text-muted">{message}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2" role="radiogroup" aria-label="Destino">
        {options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              role="radio"
              aria-checked={target === option.id}
              onClick={() => setTarget(option.id)}
              className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left active:bg-line"
            >
              {option.icon ? (
                <CategoryIcon icon={option.icon} color={option.color} size="sm" />
              ) : (
                <ColorDot color={option.color} />
              )}
              <span className="flex-1 truncate text-[15px]">{option.name}</span>
              {target === option.id && <Icon name="check" className="size-5 text-accent" />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
    </BottomSheet>
  );
}
