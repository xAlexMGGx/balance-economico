import { useRef } from 'react';
import type { KeypadKey } from '../domain/money';
import { Icon } from './Icon';

const KEYS: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'backspace'];
const LONG_PRESS_MS = 500;

/** On-screen keypad for amounts. Keeping the delete key pressed clears everything. */
export function NumericKeypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);

  const startPress = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onKey('clear');
    }, LONG_PRESS_MS);
  };
  const endPress = () => window.clearTimeout(timer.current);

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) =>
        key === 'backspace' ? (
          <button
            key={key}
            type="button"
            aria-label="Borrar"
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onPointerCancel={endPress}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (!longPressed.current) onKey('backspace');
            }}
            className="flex h-12 items-center justify-center rounded-xl bg-surface-2 text-fg active:bg-line"
          >
            <Icon name="backspace" />
          </button>
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onKey(key)}
            className="flex h-12 items-center justify-center rounded-xl bg-surface-2 text-2xl font-medium text-fg tabular-nums active:bg-line"
          >
            {key}
          </button>
        ),
      )}
    </div>
  );
}
