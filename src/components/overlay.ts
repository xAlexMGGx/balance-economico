import { useEffect, useRef } from 'react';

let lockCount = 0;

/** Stops the page behind an open sheet or dialog from scrolling. Supports nested overlays. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      lockCount -= 1;
      if (lockCount === 0) document.documentElement.style.overflow = '';
    };
  }, [active]);
}

// Only the topmost overlay reacts to Escape.
const escapeStack: Array<{ current: () => void }> = [];

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') escapeStack[escapeStack.length - 1]?.current();
  });
}

/** Calls `onEscape` when Escape is pressed and this is the topmost overlay (handy on the computer). */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => handler.current() };
    escapeStack.push(entry);
    return () => {
      escapeStack.splice(escapeStack.indexOf(entry), 1);
    };
  }, [active]);
}
