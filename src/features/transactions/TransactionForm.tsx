import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { NumericKeypad } from '../../components/NumericKeypad';
import { Button, Chip, ColorDot, Segmented } from '../../components/ui';
import { categoriesRepo, RepositoryError, settingsRepo, tagsRepo, transactionsRepo } from '../../data';
import { todayISO } from '../../domain/dates';
import { applyKeypadKey, centsToKeypadInput, formatKeypadInput, keypadInputToCents } from '../../domain/money';
import { nextColor } from '../../domain/palette';
import { buildTitleSuggestions, countBy, sortCategoriesByUsage, type TitleSuggestion } from '../../domain/transactions';
import type {
  Account,
  Category,
  CategoryDraft,
  Group,
  ISODate,
  Tag,
  Transaction,
  TransactionDraft,
  TxType,
} from '../../domain/types';
import { CategoryForm } from '../settings/CategoryForm';
import { isCategoryDraftValid, TYPE_OPTIONS } from '../settings/categoryDraft';
import { CategoryGrid } from './CategoryGrid';
import { DateChips } from './DateChips';
import { TagField } from './TagField';
import { TitleField } from './TitleField';

export type SheetRequest = { kind: 'new'; date?: ISODate } | { kind: 'edit'; transaction: Transaction };

interface TransactionFormProps {
  request: SheetRequest;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  groups: Group[];
  tags: Tag[];
  transactions: Transaction[];
  lastAccountId: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof RepositoryError ? error.message : 'No se ha podido guardar. Inténtalo de nuevo.';
}

/** Blurs the focused text field so the iPhone keyboard goes away. */
function dismissKeyboard() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export function TransactionForm(props: TransactionFormProps) {
  const { request, onClose, accounts, categories, groups, tags, transactions, lastAccountId } = props;
  const confirm = useConfirm();
  const editing = request.kind === 'edit' ? request.transaction : null;
  const today = todayISO();

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [amountInput, setAmountInput] = useState(() => (editing ? centsToKeypadInput(editing.amount) : ''));
  const [keypadOpen, setKeypadOpen] = useState(!editing);
  const [date, setDate] = useState<ISODate>(editing?.date ?? (request.kind === 'new' ? request.date : undefined) ?? today);
  const [accountId, setAccountId] = useState<string>(
    () =>
      editing?.accountId ??
      accounts.find((a) => a.id === lastAccountId)?.id ??
      accounts[0]?.id ??
      '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [tagNames, setTagNames] = useState<string[]>(() =>
    editing ? editing.tagIds.flatMap((id) => tags.find((t) => t.id === id)?.name ?? []) : [],
  );
  const [tagQuery, setTagQuery] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = keypadInputToCents(amountInput);
  const usage = useMemo(() => countBy(transactions, (t) => t.categoryId), [transactions]);
  const pickerCategories = useMemo(() => sortCategoriesByUsage(categories, usage, type), [categories, usage, type]);
  const titleSuggestions = useMemo(() => buildTitleSuggestions(transactions, type), [transactions, type]);
  const selectedCategory = pickerCategories.find((c) => c.id === categoryId);
  const canSave = amount > 0 && selectedCategory !== undefined && accounts.some((a) => a.id === accountId) && !busy;

  const changeType = (next: TxType) => {
    setType(next);
    if (categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId(null);
  };

  const toggleKeypad = () => {
    dismissKeyboard();
    setKeypadOpen((open) => !open);
  };

  const pickTitle = (suggestion: TitleSuggestion) => {
    setTitle(suggestion.title);
    if (!selectedCategory && pickerCategories.some((c) => c.id === suggestion.categoryId)) {
      setCategoryId(suggestion.categoryId);
    }
    dismissKeyboard();
  };

  const startNewCategory = () => {
    dismissKeyboard();
    setError(null);
    setNewCategory({
      name: '',
      icon: '',
      color: nextColor(categories.map((c) => c.color)),
      type,
      groupId: groups.length === 1 ? groups[0].id : null,
    });
  };

  const createCategory = async () => {
    if (!newCategory) return;
    setBusy(true);
    try {
      const id = await categoriesRepo.create(newCategory);
      setCategoryId(id);
      setNewCategory(null);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!canSave || !categoryId) return;
    setBusy(true);
    try {
      const tagIds = await tagsRepo.resolveNames([...tagNames, tagQuery]);
      const draft: TransactionDraft = {
        type,
        amount,
        date,
        accountId,
        categoryId,
        title: title.trim() || null,
        tagIds,
        recurringRuleId: editing?.recurringRuleId ?? null,
        recurringMonth: editing?.recurringMonth ?? null,
      };
      if (editing) await transactionsRepo.update(editing.id, draft);
      else await transactionsRepo.create(draft);
      await settingsRepo.set('lastAccountId', accountId);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: '¿Borrar este movimiento?',
      message: editing.recurringRuleId ? 'Viene de una regla recurrente y no se volverá a generar este mes.' : undefined,
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    await transactionsRepo.remove(editing.id);
    onClose();
  };

  if (newCategory) {
    return (
      <BottomSheet
        open
        view="category"
        onClose={() => setNewCategory(null)}
        title={type === 'expense' ? 'Nueva categoría de gasto' : 'Nueva categoría de ingreso'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setNewCategory(null)}>
              Cancelar
            </Button>
            <Button className="flex-1" disabled={!isCategoryDraftValid(newCategory) || busy} onClick={() => void createCategory()}>
              Crear
            </Button>
          </div>
        }
      >
        <div className="pt-2">
          <CategoryForm
            value={newCategory}
            onChange={(update) => setNewCategory((current) => current && update(current))}
            groups={groups}
            typeLocked
          />
          {error && <p className="mt-3 text-sm text-expense">{error}</p>}
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open
      view="main"
      onClose={onClose}
      title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}
      headerAction={
        editing && (
          <button
            type="button"
            onClick={() => void remove()}
            className="flex size-11 items-center justify-center rounded-full text-expense active:bg-surface-2"
            aria-label="Borrar movimiento"
          >
            <Icon name="trash" className="size-5" />
          </button>
        )
      }
      footer={
        <>
          {keypadOpen && (
            <div className="mb-3">
              <NumericKeypad onKey={(key) => setAmountInput((input) => applyKeypadKey(input, key))} />
            </div>
          )}
          <Button className="w-full" disabled={!canSave} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <Segmented label="Tipo de movimiento" value={type} options={TYPE_OPTIONS} onChange={changeType} />

        <button
          type="button"
          onClick={toggleKeypad}
          aria-label={`Importe: ${formatKeypadInput(amountInput)}. ${keypadOpen ? 'Ocultar' : 'Mostrar'} teclado`}
          className={`-my-1 rounded-2xl py-2 text-center transition-colors ${keypadOpen ? 'bg-surface-2' : ''}`}
        >
          <span
            className={`text-[2.5rem] leading-tight font-semibold tabular-nums ${
              amount === 0 ? 'text-muted' : type === 'income' ? 'text-income' : 'text-expense'
            }`}
          >
            {formatKeypadInput(amountInput)}
          </span>
        </button>

        <DateChips value={date} today={today} onChange={setDate} />

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cuenta">
          {accounts.map((account) => (
            <Chip key={account.id} selected={account.id === accountId} onClick={() => setAccountId(account.id)}>
              <ColorDot color={account.color} className="size-2.5" />
              {account.name}
            </Chip>
          ))}
        </div>

        <CategoryGrid
          type={type}
          categories={pickerCategories}
          selectedId={categoryId}
          onSelect={setCategoryId}
          onCreate={startNewCategory}
        />

        <TitleField
          value={title}
          onChange={setTitle}
          suggestions={titleSuggestions}
          onPick={pickTitle}
          onFocus={() => setKeypadOpen(false)}
        />

        <TagField
          tags={tags}
          selected={tagNames}
          onChange={setTagNames}
          query={tagQuery}
          onQueryChange={setTagQuery}
          onFocus={() => setKeypadOpen(false)}
        />

        {editing?.recurringRuleId && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Icon name="repeat" className="size-4 shrink-0" />
            Generado por una regla recurrente. Los cambios solo afectan a este movimiento.
          </p>
        )}
        {error && <p className="text-sm text-expense">{error}</p>}
      </div>
    </BottomSheet>
  );
}
