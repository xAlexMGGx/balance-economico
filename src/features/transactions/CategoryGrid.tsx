import { Icon } from '../../components/Icon';
import { CategoryIcon } from '../../components/ui';
import type { Category, TxType } from '../../domain/types';

interface CategoryGridProps {
  type: TxType;
  /** Already sorted, most used first. */
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function CategoryGrid({ type, categories, selectedId, onSelect, onCreate }: CategoryGridProps) {
  return (
    <div>
      {categories.length === 0 && (
        <p className="mb-2 text-sm text-muted">
          Aún no tienes categorías de {type === 'expense' ? 'gasto' : 'ingreso'}. Crea la primera:
        </p>
      )}
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Categoría">
        {categories.map((category) => {
          const selected = category.id === selectedId;
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(category.id)}
              className={`flex min-h-[4.75rem] flex-col items-center justify-start gap-1 rounded-2xl px-1 pt-2 pb-1.5 transition-colors ${
                selected ? 'bg-accent/15 ring-2 ring-accent' : 'active:bg-surface-2'
              }`}
            >
              <CategoryIcon icon={category.icon} color={category.color} />
              <span className="line-clamp-2 text-center text-xs leading-tight break-words">{category.name}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onCreate}
          className="flex min-h-[4.75rem] flex-col items-center justify-start gap-1 rounded-2xl px-1 pt-2 pb-1.5 text-muted active:bg-surface-2"
        >
          <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-line">
            <Icon name="plus" className="size-5" />
          </span>
          <span className="text-xs leading-tight">Nueva</span>
        </button>
      </div>
    </div>
  );
}
