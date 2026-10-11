import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { inputClass } from '../../components/ui';
import { cleanName, normalizeText } from '../../domain/text';
import type { Tag } from '../../domain/types';

interface TagFieldProps {
  tags: Tag[];
  /** Names of the selected tags. New names are created when the movement is saved. */
  selected: string[];
  onChange: (names: string[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onFocus: () => void;
}

const MAX_SUGGESTIONS = 8;

export function TagField({ tags, selected, onChange, query, onQueryChange, onFocus }: TagFieldProps) {
  const [focused, setFocused] = useState(false);
  const selectedKeys = new Set(selected.map(normalizeText));
  const q = normalizeText(query);
  const cleaned = cleanName(query);

  const suggestions =
    focused || q
      ? tags.filter((t) => !selectedKeys.has(normalizeText(t.name)) && normalizeText(t.name).includes(q)).slice(0, MAX_SUGGESTIONS)
      : [];
  const canCreate = cleaned !== '' && !selectedKeys.has(q) && !tags.some((t) => normalizeText(t.name) === q);

  const add = (name: string) => {
    const clean = cleanName(name);
    if (clean && !selectedKeys.has(normalizeText(clean))) {
      onChange([...selected, tags.find((t) => normalizeText(t.name) === normalizeText(clean))?.name ?? clean]);
    }
    onQueryChange('');
  };

  return (
    <div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(selected.filter((n) => n !== name))}
              className="flex h-11 items-center gap-1.5 rounded-full bg-accent/15 pr-3 pl-4 text-[15px] font-medium text-accent"
              aria-label={`Quitar tag ${name}`}
            >
              #{name}
              <Icon name="close" className="size-4" />
            </button>
          ))}
        </div>
      )}
      <input
        className={inputClass}
        placeholder="Añadir tag (opcional)"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onFocus={() => {
          setFocused(true);
          onFocus();
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            add(query);
          }
        }}
        enterKeyHint="done"
        maxLength={30}
        autoComplete="off"
        autoCapitalize="none"
        aria-label="Añadir tag"
      />
      {(suggestions.length > 0 || canCreate) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(tag.name)}
              className="h-11 rounded-full bg-surface-2 px-4 text-[15px] active:bg-line"
            >
              #{tag.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(query)}
              className="flex h-11 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[15px] text-accent"
            >
              <Icon name="plus" className="size-4" />
              Crear «{cleaned}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}
