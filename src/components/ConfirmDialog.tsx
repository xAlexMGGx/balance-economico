import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey, useScrollLock } from './overlay';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Hide the cancel button: a plain notice with a single "OK". */
  alertOnly?: boolean;
  destructive?: boolean;
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export interface ChooseOptions<T extends string> {
  title: string;
  message?: string;
  choices: ReadonlyArray<Choice<T>>;
  cancelLabel?: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;
type Choose = <T extends string>(options: ChooseOptions<T>) => Promise<T | null>;

type Dialog =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'choose'; options: ChooseOptions<string>; resolve: (value: string | null) => void };

const DialogContext = createContext<{ confirm: Confirm; choose: Choose } | null>(null);

function useDialogs() {
  const dialogs = useContext(DialogContext);
  if (!dialogs) throw new Error('Dialogs must be used inside <ConfirmProvider>');
  return dialogs;
}

/** `await confirm({...})` resolves to true when the user accepts. */
export function useConfirm(): Confirm {
  return useDialogs().confirm;
}

/** `await choose({...})` resolves to the chosen value, or null if the user cancels. */
export function useChoose(): Choose {
  return useDialogs().choose;
}

const buttonClass = 'h-12 w-full text-[17px] active:bg-surface-2';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const dialogRef = useRef<Dialog | null>(null);

  const open = useCallback((next: Dialog) => {
    dialogRef.current = next;
    setDialog(next);
  }, []);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => open({ kind: 'confirm', options, resolve })),
    [open],
  );

  const choose = useCallback<Choose>(
    <T extends string>(options: ChooseOptions<T>) =>
      new Promise<T | null>((resolve) =>
        open({ kind: 'choose', options, resolve: resolve as (value: string | null) => void }),
      ),
    [open],
  );

  const close = useCallback((value: boolean | string | null) => {
    const current = dialogRef.current;
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(value === true);
    else current.resolve(typeof value === 'string' ? value : null);
    dialogRef.current = null;
    setDialog(null);
  }, []);
  const cancel = useCallback(() => close(dialog?.kind === 'confirm' ? false : null), [close, dialog]);

  useScrollLock(dialog !== null);
  useEscapeKey(dialog !== null, cancel);

  return (
    <DialogContext.Provider value={{ confirm, choose }}>
      {children}
      {dialog &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8" role="alertdialog" aria-modal="true">
            <div className="absolute inset-0 animate-fade-in bg-backdrop" onClick={cancel} />
            <div className="relative w-full max-w-xs animate-pop-in overflow-hidden rounded-2xl bg-surface text-center shadow-2xl">
              <div className="px-5 pt-5 pb-4">
                <h2 className="text-base font-semibold">{dialog.options.title}</h2>
                {dialog.options.message && <p className="mt-1.5 text-sm text-muted">{dialog.options.message}</p>}
              </div>
              {dialog.kind === 'confirm' ? (
                <div className="flex border-t border-line">
                  {!dialog.options.alertOnly && (
                    <button type="button" onClick={cancel} className="h-12 flex-1 border-r border-line text-accent active:bg-surface-2">
                      {dialog.options.cancelLabel ?? 'Cancelar'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => close(true)}
                    className={`h-12 flex-1 font-semibold active:bg-surface-2 ${
                      dialog.options.destructive ? 'text-expense' : 'text-accent'
                    }`}
                  >
                    {dialog.options.confirmLabel ?? 'Aceptar'}
                  </button>
                </div>
              ) : (
                // More than two answers: one per row, as iOS does, with cancel last.
                <div className="flex flex-col divide-y divide-line border-t border-line">
                  {dialog.options.choices.map((choice) => (
                    <button key={choice.value} type="button" onClick={() => close(choice.value)} className={`${buttonClass} text-accent`}>
                      {choice.label}
                    </button>
                  ))}
                  <button type="button" onClick={cancel} className={`${buttonClass} font-semibold text-accent`}>
                    {dialog.options.cancelLabel ?? 'Cancelar'}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </DialogContext.Provider>
  );
}
