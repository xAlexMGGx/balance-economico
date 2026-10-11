import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey, useScrollLock } from './overlay';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Hide the cancel button: a plain notice with a single "OK". */
  alertOnly?: boolean;
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** `await confirm({...})` resolves to true when the user accepts. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback<Confirm>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolveRef.current(value);
    setOptions(null);
  }, []);
  const cancel = useCallback(() => close(false), [close]);

  useScrollLock(options !== null);
  useEscapeKey(options !== null, cancel);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8" role="alertdialog" aria-modal="true">
            <div className="absolute inset-0 animate-fade-in bg-backdrop" onClick={cancel} />
            <div className="relative w-full max-w-xs animate-pop-in overflow-hidden rounded-2xl bg-surface text-center shadow-2xl">
              <div className="px-5 pt-5 pb-4">
                <h2 className="text-base font-semibold">{options.title}</h2>
                {options.message && <p className="mt-1.5 text-sm text-muted">{options.message}</p>}
              </div>
              <div className="flex border-t border-line">
                {!options.alertOnly && (
                  <button type="button" onClick={cancel} className="h-12 flex-1 border-r border-line text-accent active:bg-surface-2">
                    Cancelar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`h-12 flex-1 font-semibold active:bg-surface-2 ${options.destructive ? 'text-expense' : 'text-accent'}`}
                >
                  {options.confirmLabel ?? 'Aceptar'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext.Provider>
  );
}
