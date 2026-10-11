import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { useEscapeKey, useScrollLock } from './overlay';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned below the scrollable content (main button, keypad…). */
  footer?: ReactNode;
  /** Extra button on the right of the header. */
  headerAction?: ReactNode;
  /** When it changes, the content scrolls back to the top (the sheet now shows a different view). */
  view?: string;
}

export function BottomSheet({ open, onClose, title, children, footer, headerAction, view }: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useEscapeKey(open, onClose);
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [view]);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-backdrop" onClick={onClose} />
      <div className="relative mx-auto flex max-h-[92dvh] w-full max-w-lg animate-sheet-in flex-col rounded-t-3xl bg-surface shadow-2xl px-safe">
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-line" aria-hidden="true" />
        <header className="grid shrink-0 grid-cols-[3rem_1fr_3rem] items-center px-1 pb-1">
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
            aria-label="Cerrar"
          >
            <Icon name="close" />
          </button>
          <h2 className="truncate text-center text-base font-semibold">{title}</h2>
          <div className="flex justify-end">{headerAction}</div>
        </header>
        <div
          ref={contentRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${footer ? 'pb-4' : 'pb-safe-or-3'}`}
        >
          {children}
        </div>
        {footer && <div className="shrink-0 border-t border-line px-4 pt-3 pb-safe-or-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
