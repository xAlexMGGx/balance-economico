import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { ColorPicker } from '../../components/ColorPicker';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, ColorDot, EmptyState, Field, ListCard, Page, inputClass } from '../../components/ui';
import { groupsRepo, RepositoryError, useCategories, useGroups } from '../../data';
import { nextColor } from '../../domain/palette';
import { cleanName } from '../../domain/text';
import { countBy } from '../../domain/transactions';
import type { Group } from '../../domain/types';
import { ReassignSheet } from './ReassignSheet';
import { SettingsRow } from './SettingsRow';

const categoriesText = (n: number) => (n === 1 ? '1 categoría' : `${n} categorías`);

export function GroupsPage() {
  const groups = useGroups();
  const categories = useCategories();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const [reassigning, setReassigning] = useState<{ group: Group; count: number } | null>(null);

  const counts = useMemo(
    () => countBy((categories ?? []).filter((c) => c.groupId !== null), (c) => c.groupId as string),
    [categories],
  );

  if (!groups) return null;
  const ids = groups.map((g) => g.id);

  const requestDelete = async (group: Group) => {
    const count = await groupsRepo.categoryCount(group.id);
    if (count > 0) {
      if (groups.length <= 1) {
        await confirm({
          title: 'No se puede borrar',
          message: `Este grupo tiene ${categoriesText(count)} y no hay otro grupo al que moverlas. Crea otro grupo primero.`,
          alertOnly: true,
        });
        return;
      }
      setEditing(null);
      setReassigning({ group, count });
      return;
    }
    const ok = await confirm({ title: `¿Borrar «${group.name}»?`, confirmLabel: 'Borrar', destructive: true });
    if (ok) {
      await groupsRepo.remove(group.id);
      setEditing(null);
    }
  };

  return (
    <Page>
      <p className="mb-3 px-1 text-sm text-muted">
        Los grupos reúnen categorías de gasto, por ejemplo «Necesario» y «Ocio». En Análisis verás el gasto por grupo.
      </p>
      {groups.length === 0 ? (
        <EmptyState title="Aún no hay grupos" />
      ) : (
        <ListCard>
          {groups.map((group) => (
            <SettingsRow
              key={group.id}
              id={group.id}
              siblingIds={ids}
              onReorder={(order) => void groupsRepo.reorder(order)}
              onClick={() => setEditing(group)}
              leading={<ColorDot color={group.color} className="size-4" />}
              title={group.name}
              subtitle={categoriesText(counts.get(group.id) ?? 0)}
            />
          ))}
        </ListCard>
      )}
      <Button variant="plain" className="mt-2 w-full" onClick={() => setEditing('new')}>
        <Icon name="plus" className="size-5" />
        Añadir grupo
      </Button>

      {editing && (
        <GroupSheet
          group={editing === 'new' ? null : editing}
          usedColors={groups.map((g) => g.color)}
          onClose={() => setEditing(null)}
          onDelete={(group) => void requestDelete(group)}
        />
      )}

      {reassigning && (
        <ReassignSheet
          title={`Borrar «${reassigning.group.name}»`}
          message={`Este grupo tiene ${categoriesText(reassigning.count)}. Elige a qué grupo moverlas antes de borrarlo.`}
          options={groups.filter((g) => g.id !== reassigning.group.id)}
          onConfirm={async (target) => {
            await groupsRepo.remove(reassigning.group.id, target);
            setReassigning(null);
          }}
          onClose={() => setReassigning(null)}
        />
      )}
    </Page>
  );
}

function GroupSheet({
  group,
  usedColors,
  onClose,
  onDelete,
}: {
  group: Group | null;
  usedColors: string[];
  onClose: () => void;
  onDelete: (group: Group) => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState(group?.color ?? nextColor(usedColors));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      if (group) await groupsRepo.update(group.id, { name, color });
      else await groupsRepo.create({ name, color });
      onClose();
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido guardar.');
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={group ? 'Editar grupo' : 'Nuevo grupo'}
      footer={
        <Button className="w-full" disabled={!cleanName(name)} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <Field label="Nombre">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>
        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>
        {error && <p className="text-sm text-expense">{error}</p>}
        {group && (
          <Button variant="danger" onClick={() => onDelete(group)}>
            <Icon name="trash" className="size-5" />
            Borrar grupo
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
