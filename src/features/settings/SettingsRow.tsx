import type { ReactNode } from 'react';
import { ReorderButtons } from '../../components/ui';
import { moveId } from '../../domain/ordering';

interface SettingsRowProps {
  leading: ReactNode;
  title: string;
  subtitle?: ReactNode;
  onClick: () => void;
  /** Ids of the list the row belongs to, in their current order, to move it up or down. */
  siblingIds: string[];
  id: string;
  onReorder: (ids: string[]) => void;
}

/** Row of an editable list in Ajustes: tap to edit, arrows to reorder. */
export function SettingsRow({ leading, title, subtitle, onClick, siblingIds, id, onReorder }: SettingsRowProps) {
  const index = siblingIds.indexOf(id);
  return (
    <li className="flex items-center pr-1">
      <button type="button" onClick={onClick} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left active:opacity-60">
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
        </span>
      </button>
      <ReorderButtons
        name={title}
        canMoveUp={index > 0}
        canMoveDown={index < siblingIds.length - 1}
        onMove={(direction) => {
          const ids = moveId(siblingIds, id, direction);
          if (ids) onReorder(ids);
        }}
      />
    </li>
  );
}
