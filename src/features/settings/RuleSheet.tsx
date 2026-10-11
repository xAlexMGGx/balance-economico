import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, Chip, ColorDot, Field, Segmented, Switch, inputClass, selectClass } from '../../components/ui';
import { recurringRepo, RepositoryError, tagsRepo, useGeneratedMonths } from '../../data';
import { addMonths, formatMonth, isValidYearMonth, todayISO, toYearMonth } from '../../domain/dates';
import { centsToText, parseAmountText } from '../../domain/money';
import { changesMovement, pendingMonths } from '../../domain/recurring';
import { buildTitleSuggestions, countBy, sortCategoriesByUsage, type TitleSuggestion } from '../../domain/transactions';
import type { Account, Category, RecurringRule, RecurringRuleDraft, Tag, Transaction, TxType } from '../../domain/types';
import { CategoryGrid } from '../transactions/CategoryGrid';
import { TagField } from '../transactions/TagField';
import { TitleField } from '../transactions/TitleField';
import { TYPE_OPTIONS } from './categoryDraft';

interface RuleSheetProps {
  rule: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
  tags: Tag[];
  transactions: Transaction[];
  lastAccountId: string | null;
  onClose: () => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function draftOf(rule: RecurringRule): RecurringRuleDraft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = rule;
  return draft;
}

/** What saving will create, so a start month far in the past never surprises anyone. */
function generationPreview(pending: string[], startMonth: string, currentMonth: string, isNew: boolean): string | null {
  if (pending.length === 0) {
    return isNew && startMonth > currentMonth
      ? `El primer movimiento aparecerá el 1 de ${formatMonth(startMonth, { long: true })}.`
      : null;
  }
  const first = formatMonth(pending[0], { long: true });
  const last = formatMonth(pending[pending.length - 1], { long: true });
  if (pending.length === 1) return `Al guardar se creará el movimiento de ${first}.`;
  return `Al guardar se crearán ${pending.length} movimientos, de ${first} a ${last}.`;
}

export function RuleSheet({ rule, accounts, categories, tags, transactions, lastAccountId, onClose }: RuleSheetProps) {
  const confirm = useConfirm();
  const today = todayISO();
  const currentMonth = toYearMonth(today);
  const generated = useGeneratedMonths(rule?.id ?? null);

  const [type, setType] = useState<TxType>(rule?.type ?? 'expense');
  const [amountText, setAmountText] = useState(rule ? centsToText(rule.amount) : '');
  const [dayOfMonth, setDayOfMonth] = useState(rule?.dayOfMonth ?? Number(today.slice(8)));
  const [accountId, setAccountId] = useState(
    () => rule?.accountId ?? accounts.find((a) => a.id === lastAccountId)?.id ?? accounts[0]?.id ?? '',
  );
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null);
  const [title, setTitle] = useState(rule?.title ?? '');
  const [tagNames, setTagNames] = useState<string[]>(() =>
    rule ? rule.tagIds.flatMap((id) => tags.find((t) => t.id === id)?.name ?? []) : [],
  );
  const [tagQuery, setTagQuery] = useState('');
  const [startMonth, setStartMonth] = useState(rule?.startMonth ?? currentMonth);
  const [hasEnd, setHasEnd] = useState(rule?.endMonth != null);
  const [endMonth, setEndMonth] = useState(rule?.endMonth ?? addMonths(rule?.startMonth ?? currentMonth, 11));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usage = useMemo(() => countBy(transactions, (t) => t.categoryId), [transactions]);
  const pickerCategories = useMemo(() => sortCategoriesByUsage(categories, usage, type), [categories, usage, type]);
  const titleSuggestions = useMemo(() => buildTitleSuggestions(transactions, type), [transactions, type]);

  const parsedAmount = parseAmountText(amountText);
  const amount = parsedAmount !== null && parsedAmount > 0 ? parsedAmount : null;
  const datesValid = isValidYearMonth(startMonth) && (!hasEnd || (isValidYearMonth(endMonth) && endMonth >= startMonth));
  const selectedCategory = pickerCategories.find((c) => c.id === categoryId);
  const canSave = amount !== null && selectedCategory !== undefined && datesValid && !busy && generated !== undefined;

  const pending = datesValid
    ? pendingMonths({ startMonth, endMonth: hasEnd ? endMonth : null }, new Set(generated ?? []), currentMonth)
    : [];
  const preview = generationPreview(pending, startMonth, currentMonth, rule === null);

  const changeType = (next: TxType) => {
    setType(next);
    if (categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId(null);
  };

  const pickTitle = (suggestion: TitleSuggestion) => {
    setTitle(suggestion.title);
    if (!selectedCategory && pickerCategories.some((c) => c.id === suggestion.categoryId)) setCategoryId(suggestion.categoryId);
  };

  const save = async () => {
    if (!canSave || amount === null || !categoryId) return;
    setBusy(true);
    try {
      const draft: RecurringRuleDraft = {
        type,
        amount,
        dayOfMonth,
        accountId,
        categoryId,
        title: title.trim() || null,
        tagIds: await tagsRepo.resolveNames([...tagNames, tagQuery]),
        startMonth,
        endMonth: hasEnd ? endMonth : null,
      };
      if (rule) {
        let applyToCurrentMonth = false;
        if (changesMovement(draftOf(rule), draft) && (await recurringRepo.currentMonthTransaction(rule.id))) {
          applyToCurrentMonth = await confirm({
            title: `¿Aplicar también a ${formatMonth(currentMonth, { long: true })}?`,
            message:
              'El movimiento de este mes ya está creado. Puedes actualizarlo con los nuevos datos o dejarlo como está y aplicar el cambio solo a los meses siguientes.',
            confirmLabel: 'Aplicar también',
            cancelLabel: 'Solo siguientes',
          });
        }
        await recurringRepo.update(rule.id, draft, { applyToCurrentMonth });
      } else {
        await recurringRepo.create(draft);
      }
      onClose();
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido guardar.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!rule) return;
    const ok = await confirm({
      title: '¿Borrar esta regla?',
      message: 'Dejarán de crearse movimientos nuevos. Los que ya se crearon se conservan.',
      confirmLabel: 'Borrar',
      destructive: true,
    });
    if (!ok) return;
    await recurringRepo.remove(rule.id);
    onClose();
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={rule ? 'Editar regla' : 'Nueva regla recurrente'}
      footer={
        <Button className="w-full" disabled={!canSave} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-1">
        <Segmented label="Tipo de movimiento" value={type} options={TYPE_OPTIONS} onChange={changeType} />

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Importe" hint={amountText && amount === null ? 'Escribe un importe como 1.234,56' : undefined}>
            <div className="relative">
              <input
                className={`${inputClass} pr-8`}
                inputMode="decimal"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">€</span>
            </div>
          </Field>
          <Field label="Día del mes">
            <select className={selectClass} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  Día {day}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {dayOfMonth > 28 && (
          <p className="-mt-3 text-[13px] text-muted">Los meses que no tienen día {dayOfMonth} usarán su último día.</p>
        )}

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cuenta">
          {accounts.map((account) => (
            <Chip key={account.id} selected={account.id === accountId} onClick={() => setAccountId(account.id)}>
              <ColorDot color={account.color} className="size-2.5" />
              {account.name}
            </Chip>
          ))}
        </div>

        <CategoryGrid type={type} categories={pickerCategories} selectedId={categoryId} onSelect={setCategoryId} />

        <TitleField value={title} onChange={setTitle} suggestions={titleSuggestions} onPick={pickTitle} onFocus={() => {}} />
        <TagField
          tags={tags}
          selected={tagNames}
          onChange={setTagNames}
          query={tagQuery}
          onQueryChange={setTagQuery}
          onFocus={() => {}}
        />

        <Field label="Desde">
          <input
            type="month"
            className={inputClass}
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            aria-label="Mes de inicio"
          />
        </Field>
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-medium">Tiene mes de fin</span>
            <Switch checked={hasEnd} onChange={setHasEnd} label="Tiene mes de fin" />
          </div>
          {hasEnd && (
            <input
              type="month"
              className={`${inputClass} mt-2`}
              value={endMonth}
              min={startMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              aria-label="Mes de fin"
            />
          )}
          {!datesValid && <p className="mt-1 text-[13px] text-expense">El mes de fin tiene que ser igual o posterior al de inicio.</p>}
        </div>

        <div className="flex gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-[13px] text-muted">
          <Icon name="repeat" className="mt-0.5 size-4 shrink-0" />
          <p>
            {preview && <span className="block font-medium text-fg">{preview}</span>}
            {rule
              ? 'Los cambios se aplican a los meses que aún no se han creado. Cada movimiento creado se puede editar por separado.'
              : 'Se creará un movimiento normal cada mes. El del mes en curso aparece desde el día 1 aunque su fecha sea posterior.'}
          </p>
        </div>

        {error && <p className="text-sm text-expense">{error}</p>}

        {rule && (
          <Button variant="danger" onClick={() => void remove()}>
            <Icon name="trash" className="size-5" />
            Borrar regla
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
