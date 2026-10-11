import { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { ColorPicker } from '../../components/ColorPicker';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, ColorDot, Field, ListCard, Page, Switch, inputClass } from '../../components/ui';
import { accountsRepo, isInUse, RepositoryError, useAccounts, useTransactions, type Usage } from '../../data';
import { computeAccountBalances } from '../../domain/balances';
import { todayISO } from '../../domain/dates';
import { centsToText, formatCents, parseAmountText } from '../../domain/money';
import { nextColor } from '../../domain/palette';
import { cleanName } from '../../domain/text';
import type { Account } from '../../domain/types';
import { ReassignSheet } from './ReassignSheet';
import { SettingsRow } from './SettingsRow';
import { usageText } from './usage';

export function AccountsPage() {
  const accounts = useAccounts();
  const transactions = useTransactions();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [reassigning, setReassigning] = useState<{ account: Account; usage: Usage } | null>(null);

  const balances = useMemo(
    () => computeAccountBalances(accounts ?? [], transactions ?? [], todayISO()),
    [accounts, transactions],
  );

  if (!accounts) return null;
  const ids = accounts.map((a) => a.id);

  const requestDelete = async (account: Account) => {
    if (accounts.length <= 1) {
      await confirm({ title: 'No se puede borrar', message: 'Tiene que quedar al menos una cuenta.', alertOnly: true });
      return;
    }
    const usage = await accountsRepo.usage(account.id);
    if (isInUse(usage)) {
      setEditing(null);
      setReassigning({ account, usage });
      return;
    }
    const ok = await confirm({ title: `¿Borrar «${account.name}»?`, confirmLabel: 'Borrar', destructive: true });
    if (ok) {
      await accountsRepo.remove(account.id);
      setEditing(null);
    }
  };

  return (
    <Page>
      <ListCard>
        {accounts.map((account) => (
          <SettingsRow
            key={account.id}
            id={account.id}
            siblingIds={ids}
            onReorder={(order) => void accountsRepo.reorder(order)}
            onClick={() => setEditing(account)}
            leading={<ColorDot color={account.color} className="size-4" />}
            title={account.name}
            subtitle={
              <>
                <span className="tabular-nums">{formatCents(balances.get(account.id) ?? 0)}</span>
                {account.countsForSavings && ' · Cuenta para ahorro'}
              </>
            }
          />
        ))}
      </ListCard>
      <Button variant="plain" className="mt-2 w-full" onClick={() => setEditing('new')}>
        <Icon name="plus" className="size-5" />
        Añadir cuenta
      </Button>

      {editing && (
        <AccountSheet
          account={editing === 'new' ? null : editing}
          usedColors={accounts.map((a) => a.color)}
          onClose={() => setEditing(null)}
          onDelete={(account) => void requestDelete(account)}
        />
      )}

      {reassigning && (
        <ReassignSheet
          title={`Borrar «${reassigning.account.name}»`}
          message={`Esta cuenta tiene ${usageText(reassigning.usage)}. Elige a qué cuenta moverlos antes de borrarla.`}
          options={accounts.filter((a) => a.id !== reassigning.account.id)}
          onConfirm={async (target) => {
            await accountsRepo.remove(reassigning.account.id, target);
            setReassigning(null);
          }}
          onClose={() => setReassigning(null)}
        />
      )}
    </Page>
  );
}

function AccountSheet({
  account,
  usedColors,
  onClose,
  onDelete,
}: {
  account: Account | null;
  usedColors: string[];
  onClose: () => void;
  onDelete: (account: Account) => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [color, setColor] = useState(account?.color ?? nextColor(usedColors));
  const [balanceText, setBalanceText] = useState(account && account.initialBalance !== 0 ? centsToText(account.initialBalance) : '');
  const [countsForSavings, setCountsForSavings] = useState(account?.countsForSavings ?? false);
  const [error, setError] = useState<string | null>(null);

  const initialBalance = balanceText.trim() === '' ? 0 : parseAmountText(balanceText);
  const valid = cleanName(name) !== '' && initialBalance !== null;

  const toggleSign = () =>
    setBalanceText((text) => {
      const t = text.trim();
      return t.startsWith('-') ? t.slice(1) : `-${t}`;
    });

  const save = async () => {
    if (!valid || initialBalance === null) return;
    const draft = { name, color, initialBalance, countsForSavings };
    try {
      if (account) await accountsRepo.update(account.id, draft);
      else await accountsRepo.create(draft);
      onClose();
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : 'No se ha podido guardar.');
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={account ? 'Editar cuenta' : 'Nueva cuenta'}
      footer={
        <Button className="w-full" disabled={!valid} onClick={() => void save()}>
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <Field label="Nombre">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>

        <Field label="Saldo inicial" hint={initialBalance === null ? 'Escribe un importe como 1.234,56' : undefined}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={toggleSign}
              className="h-11 w-12 shrink-0 rounded-xl bg-surface-2 text-xl font-semibold"
              aria-label="Cambiar signo"
            >
              ±
            </button>
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder="0,00"
              value={balanceText}
              onChange={(e) => setBalanceText(e.target.value)}
            />
          </div>
        </Field>

        <div className="flex items-center gap-3 rounded-xl bg-surface-2 py-1 pr-2 pl-3">
          <div className="flex-1">
            <p className="text-[15px] font-medium">Cuenta para ahorro</p>
            <p className="text-[13px] text-muted">Sus ingresos y gastos cuentan en el ahorro total.</p>
          </div>
          <Switch checked={countsForSavings} onChange={setCountsForSavings} label="Cuenta para ahorro" />
        </div>

        <Field label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        {error && <p className="text-sm text-expense">{error}</p>}

        {account && (
          <Button variant="danger" onClick={() => onDelete(account)}>
            <Icon name="trash" className="size-5" />
            Borrar cuenta
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
