import { useState } from 'react';
import { Link } from 'react-router';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, CategoryIcon, ColorDot, EmptyState, ListCard, Page, Segmented, SectionTitle } from '../../components/ui';
import {
  categoriesRepo,
  isInUse,
  RepositoryError,
  useCategories,
  useCategoryUsage,
  useGroups,
  type Usage,
} from '../../data';
import { nextColor } from '../../domain/palette';
import type { Category, CategoryDraft, Group, TxType } from '../../domain/types';
import { CategoryForm } from './CategoryForm';
import { isCategoryDraftValid } from './categoryDraft';
import { ReassignSheet } from './ReassignSheet';
import { SettingsRow } from './SettingsRow';
import { usageText } from './usage';

const TABS = [
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
] as const;

export function CategoriesPage() {
  const categories = useCategories();
  const groups = useGroups();
  const confirm = useConfirm();
  const [tab, setTab] = useState<TxType>('expense');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [reassigning, setReassigning] = useState<{ category: Category; usage: Usage } | null>(null);

  if (!categories || !groups) return null;

  const ofType = categories.filter((c) => c.type === tab);
  // Expense categories are listed by group; income categories in a single list.
  const sections: Array<{ key: string; group: Group | null; items: Category[] }> =
    tab === 'income'
      ? [{ key: 'income', group: null, items: ofType }]
      : [
          ...groups.map((group) => ({ key: group.id, group, items: ofType.filter((c) => c.groupId === group.id) })),
          { key: 'orphans', group: null, items: ofType.filter((c) => !groups.some((g) => g.id === c.groupId)) },
        ].filter((s) => s.items.length > 0);

  const requestDelete = async (category: Category) => {
    const usage = await categoriesRepo.usage(category.id);
    if (isInUse(usage)) {
      const others = categories.filter((c) => c.type === category.type && c.id !== category.id);
      if (others.length === 0) {
        await confirm({
          title: 'No se puede borrar',
          message: `Esta categoría tiene ${usageText(usage)} y no hay otra categoría de ${
            category.type === 'expense' ? 'gasto' : 'ingreso'
          } a la que moverlos. Crea otra primero.`,
          alertOnly: true,
        });
        return;
      }
      setEditing(null);
      setReassigning({ category, usage });
      return;
    }
    const ok = await confirm({ title: `¿Borrar «${category.name}»?`, confirmLabel: 'Borrar', destructive: true });
    if (ok) {
      await categoriesRepo.remove(category.id);
      setEditing(null);
    }
  };

  return (
    <Page>
      <Segmented label="Tipo de categoría" value={tab} options={TABS} onChange={setTab} />

      {tab === 'expense' && groups.length === 0 && (
        <p className="mt-4 px-1 text-sm text-muted">
          Las categorías de gasto van dentro de un grupo. Puedes crearlo al crear la categoría o desde{' '}
          <Link to="/settings/groups" className="font-semibold text-accent">
            Grupos
          </Link>
          .
        </p>
      )}

      {sections.length === 0 ? (
        <EmptyState title={tab === 'expense' ? 'Aún no hay categorías de gasto' : 'Aún no hay categorías de ingreso'} />
      ) : (
        <div className="mt-5 flex flex-col gap-5">
          {sections.map((section) => {
            const ids = section.items.map((c) => c.id);
            return (
              <section key={section.key}>
                {tab === 'expense' && (
                  <SectionTitle>
                    <span className="flex items-center gap-1.5">
                      {section.group && <ColorDot color={section.group.color} className="size-2" />}
                      {section.group?.name ?? 'Sin grupo'}
                    </span>
                  </SectionTitle>
                )}
                <ListCard>
                  {section.items.map((category) => (
                    <SettingsRow
                      key={category.id}
                      id={category.id}
                      siblingIds={ids}
                      onReorder={(order) => void categoriesRepo.reorder(order)}
                      onClick={() => setEditing(category)}
                      leading={<CategoryIcon icon={category.icon} color={category.color} size="sm" />}
                      title={category.name}
                    />
                  ))}
                </ListCard>
              </section>
            );
          })}
        </div>
      )}

      <Button variant="plain" className="mt-2 w-full" onClick={() => setEditing('new')}>
        <Icon name="plus" className="size-5" />
        Añadir categoría
      </Button>

      {editing && (
        <CategorySheet
          category={editing === 'new' ? null : editing}
          initialType={tab}
          groups={groups}
          usedColors={categories.map((c) => c.color)}
          onClose={() => setEditing(null)}
          onDelete={(category) => void requestDelete(category)}
        />
      )}

      {reassigning && (
        <ReassignSheet
          title={`Borrar «${reassigning.category.name}»`}
          message={`Esta categoría tiene ${usageText(reassigning.usage)}. Elige a qué categoría moverlos antes de borrarla.`}
          options={categories.filter((c) => c.type === reassigning.category.type && c.id !== reassigning.category.id)}
          onConfirm={async (target) => {
            await categoriesRepo.remove(reassigning.category.id, target);
            setReassigning(null);
          }}
          onClose={() => setReassigning(null)}
        />
      )}
    </Page>
  );
}

function CategorySheet({
  category,
  initialType,
  groups,
  usedColors,
  onClose,
  onDelete,
}: {
  category: Category | null;
  initialType: TxType;
  groups: Group[];
  usedColors: string[];
  onClose: () => void;
  onDelete: (category: Category) => void;
}) {
  const usage = useCategoryUsage(category?.id ?? null);
  const [draft, setDraft] = useState<CategoryDraft>(() =>
    category
      ? { name: category.name, icon: category.icon, color: category.color, type: category.type, groupId: category.groupId }
      : {
          name: '',
          icon: '',
          color: nextColor(usedColors),
          type: initialType,
          groupId: initialType === 'expense' && groups.length === 1 ? groups[0].id : null,
        },
  );
  const [error, setError] = useState<string | null>(null);
  const typeLocked = category !== null && (usage === undefined || (usage !== null && isInUse(usage)));

  const save = async () => {
    try {
      if (category) await categoriesRepo.update(category.id, draft);
      else await categoriesRepo.create(draft);
      onClose();
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido guardar.');
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={category ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <Button className="w-full" disabled={!isCategoryDraftValid(draft)} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <CategoryForm value={draft} onChange={setDraft} groups={groups} typeLocked={typeLocked} />
        {typeLocked && usage && (
          <p className="text-[13px] text-muted">
            Es una categoría de {draft.type === 'expense' ? 'gasto' : 'ingreso'} con {usageText(usage)}, así que su tipo no se puede
            cambiar.
          </p>
        )}
        {error && <p className="text-sm text-expense">{error}</p>}
        {category && (
          <Button variant="danger" onClick={() => onDelete(category)}>
            <Icon name="trash" className="size-5" />
            Borrar categoría
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
