import { useState } from 'react';
import { ColorPicker } from '../../components/ColorPicker';
import { EmojiPicker } from '../../components/EmojiPicker';
import { Icon } from '../../components/Icon';
import { CategoryIcon, Chip, ColorDot, Field, Segmented, inputClass } from '../../components/ui';
import { groupsRepo, RepositoryError } from '../../data';
import { nextColor } from '../../domain/palette';
import { cleanName } from '../../domain/text';
import type { CategoryDraft, Group } from '../../domain/types';
import { TYPE_OPTIONS } from './categoryDraft';

interface CategoryFormProps {
  value: CategoryDraft;
  /** Receives an updater, so changes made after an await never overwrite newer ones. */
  onChange: (update: (current: CategoryDraft) => CategoryDraft) => void;
  groups: Group[];
  /** The type cannot change once the category has movements. */
  typeLocked?: boolean;
}

/** Fields of a category. Used in Ajustes and when creating a category while adding a movement. */
export function CategoryForm({ value, onChange, groups, typeLocked = false }: CategoryFormProps) {
  const set = (changes: Partial<CategoryDraft>) => onChange((current) => ({ ...current, ...changes }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <CategoryIcon icon={value.icon || '❓'} color={value.color} size="lg" />
        <input
          className={inputClass}
          placeholder="Nombre"
          value={value.name}
          onChange={(event) => set({ name: event.target.value })}
          aria-label="Nombre"
          maxLength={40}
        />
      </div>

      {!typeLocked && (
        <Segmented
          label="Tipo"
          value={value.type}
          options={TYPE_OPTIONS}
          onChange={(type) =>
            onChange((current) => ({ ...current, type, groupId: type === 'income' ? null : current.groupId }))
          }
        />
      )}

      {value.type === 'expense' && (
        <GroupPicker groups={groups} value={value.groupId} onChange={(groupId) => set({ groupId })} />
      )}

      <Field label="Icono">
        <EmojiPicker value={value.icon} onChange={(icon) => set({ icon })} />
      </Field>

      <Field label="Color">
        <ColorPicker value={value.color} onChange={(color) => set({ color })} />
      </Field>
    </div>
  );
}

function GroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: Group[];
  value: string | null;
  onChange: (groupId: string) => void;
}) {
  const [creating, setCreating] = useState(groups.length === 0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    try {
      const id = await groupsRepo.create({ name, color: nextColor(groups.map((g) => g.color)) });
      onChange(id);
      setName('');
      setCreating(false);
      setError(null);
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido crear el grupo.');
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-muted">Grupo</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Grupo">
        {groups.map((group) => (
          <Chip key={group.id} selected={group.id === value} onClick={() => onChange(group.id)}>
            <ColorDot color={group.color} />
            {group.name}
          </Chip>
        ))}
        {!creating && (
          <Chip action selected={false} onClick={() => setCreating(true)}>
            <Icon name="plus" className="size-4" />
            Nuevo grupo
          </Chip>
        )}
      </div>
      {creating && (
        <div className="mt-2">
          {groups.length === 0 && (
            <p className="mb-2 text-sm text-muted">Las categorías de gasto van dentro de un grupo, por ejemplo «Necesario» u «Ocio».</p>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="Nombre del grupo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void create();
                }
              }}
              aria-label="Nombre del grupo"
              maxLength={40}
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={!cleanName(name)}
              className="h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-40"
            >
              Crear
            </button>
          </div>
          {error && <p className="mt-1 text-sm text-expense">{error}</p>}
        </div>
      )}
    </div>
  );
}
