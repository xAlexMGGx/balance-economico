import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, Field, ListCard, Page, inputClass } from '../../components/ui';
import { RepositoryError, tagsRepo, useTags, useTransactions } from '../../data';
import { cleanName } from '../../domain/text';
import { countBy } from '../../domain/transactions';
import type { Tag } from '../../domain/types';
import { SettingsRow } from './SettingsRow';

const movementsText = (n: number) => (n === 1 ? '1 movimiento' : `${n} movimientos`);

export function TagsPage() {
  const tags = useTags();
  const transactions = useTransactions();
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tag | null>(null);

  const counts = useMemo(() => countBy(transactions ?? [], (t) => t.tagIds), [transactions]);

  if (!tags) return null;
  const ids = tags.map((t) => t.id);

  const add = async () => {
    try {
      await tagsRepo.create(newName);
      setNewName('');
      setError(null);
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido crear el tag.');
    }
  };

  const requestDelete = async (tag: Tag) => {
    const count = counts.get(tag.id) ?? 0;
    const ok = await confirm({
      title: `¿Borrar #${tag.name}?`,
      message: count > 0 ? `Se quitará de ${movementsText(count)}. Los movimientos no se borran.` : undefined,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (ok) {
      await tagsRepo.remove(tag.id);
      setEditing(null);
    }
  };

  return (
    <Page>
      <form
        className="mb-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          className={`${inputClass} bg-surface`}
          placeholder="Nuevo tag"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
          autoCapitalize="none"
          enterKeyHint="done"
          aria-label="Nuevo tag"
        />
        <button
          type="submit"
          disabled={!cleanName(newName)}
          className="h-11 shrink-0 rounded-xl bg-accent px-4 font-semibold text-white disabled:opacity-40"
        >
          Añadir
        </button>
      </form>
      {error && <p className="-mt-3 mb-4 px-1 text-sm text-expense">{error}</p>}

      {tags.length === 0 ? (
        <EmptyState title="Aún no hay tags">También puedes crearlos al añadir un movimiento.</EmptyState>
      ) : (
        <ListCard>
          {tags.map((tag) => (
            <SettingsRow
              key={tag.id}
              id={tag.id}
              siblingIds={ids}
              onReorder={(order) => void tagsRepo.reorder(order)}
              onClick={() => setEditing(tag)}
              leading={<Icon name="tag" className="size-5 text-muted" />}
              title={tag.name}
              subtitle={movementsText(counts.get(tag.id) ?? 0)}
            />
          ))}
        </ListCard>
      )}

      {editing && <TagSheet tag={editing} onClose={() => setEditing(null)} onDelete={(tag) => void requestDelete(tag)} />}
    </Page>
  );
}

function TagSheet({ tag, onClose, onDelete }: { tag: Tag; onClose: () => void; onDelete: (tag: Tag) => void }) {
  const [name, setName] = useState(tag.name);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    try {
      await tagsRepo.rename(tag.id, name);
      onClose();
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido guardar.');
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Editar tag"
      footer={
        <Button className="w-full" disabled={!cleanName(name)} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <Field label="Nombre">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoCapitalize="none"
          />
        </Field>
        {error && <p className="text-sm text-expense">{error}</p>}
        <Button variant="danger" onClick={() => onDelete(tag)}>
          <Icon name="trash" className="size-5" />
          Borrar tag
        </Button>
      </div>
    </BottomSheet>
  );
}
