import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { formatCents } from '../domain/money';
import type { Cents, TxType } from '../domain/types';
import { Icon } from './Icon';

// Small building blocks shared by every screen.

/** Shown instead of a number that has no data. */
export const DASH = '—';

export const inputClass =
  'h-11 w-full rounded-xl bg-surface-2 px-3 text-base text-fg placeholder:text-muted outline-none focus:ring-2 focus:ring-accent';

export const selectClass = `${inputClass} appearance-none pr-8`;

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'plain' }) {
  const styles = {
    primary: 'bg-accent text-white disabled:opacity-40',
    secondary: 'bg-surface-2 text-fg disabled:opacity-40',
    danger: 'bg-expense/10 text-expense disabled:opacity-40',
    plain: 'text-accent disabled:opacity-40',
  }[variant];
  return (
    <button
      type="button"
      className={`flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-transform active:scale-[0.98] ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1.5 flex min-h-6 items-end justify-between gap-2 px-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</h3>
      {action}
    </div>
  );
}

/** iOS-style grouped list. */
export function ListCard({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">{children}</ul>;
}

export function ColorDot({ color, className = 'size-3' }: { color: string; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

export function CategoryIcon({ icon, color, size = 'md' }: { icon: string; color: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-8 text-base', md: 'size-10 text-xl', lg: 'size-12 text-2xl' }[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full leading-none ${sizes}`}
      style={{ backgroundColor: `${color}2e` }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

export function Amount({ cents, type, className = '' }: { cents: Cents; type: TxType; className?: string }) {
  return (
    <span className={`tabular-nums ${type === 'income' ? 'text-income' : 'text-expense'} ${className}`}>
      {formatCents(type === 'income' ? cents : -cents, { signDisplay: 'always' })}
    </span>
  );
}

export function RecurringBadge({ className = 'size-3.5' }: { className?: string }) {
  return (
    <span className="inline-flex text-muted" title="Recurrente" aria-label="Recurrente">
      <Icon name="repeat" className={className} />
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`h-10 flex-1 rounded-lg text-[15px] font-semibold transition-colors ${
              selected ? 'bg-raised text-fg shadow-sm' : 'text-muted'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-11 shrink-0 items-center"
    >
      <span className={`relative h-[31px] w-[51px] rounded-full transition-colors ${checked ? 'bg-income' : 'bg-line'}`}>
        <span
          className={`absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  );
}

/** Pill button. By default it is one option of a single choice; `action` makes it a plain button. */
export function Chip({
  selected,
  onClick,
  children,
  className = '',
  action = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  action?: boolean;
}) {
  return (
    <button
      type="button"
      role={action ? undefined : 'radio'}
      aria-checked={action ? undefined : selected}
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium transition-colors ${
        selected ? 'bg-accent text-white' : 'bg-surface-2 text-fg'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/** Up/down buttons to reorder an item in a list. */
export function ReorderButtons({
  onMove,
  canMoveUp,
  canMoveDown,
  name,
}: {
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  name: string;
}) {
  const style = 'flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2 disabled:opacity-25';
  return (
    <div className="flex shrink-0">
      <button type="button" className={style} disabled={!canMoveUp} onClick={() => onMove(-1)} aria-label={`Subir ${name}`}>
        <Icon name="chevronUp" className="size-5" />
      </button>
      <button type="button" className={style} disabled={!canMoveDown} onClick={() => onMove(1)} aria-label={`Bajar ${name}`}>
        <Icon name="chevronDown" className="size-5" />
      </button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-lg px-4 pt-2 pb-32">{children}</div>;
}
