import { createPortal } from 'react-dom';
import { NavLink } from 'react-router';
import { SECTIONS } from '../../routes';
import { Icon } from '../Icon';
import { useEscapeKey, useScrollLock } from '../overlay';

export function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  useScrollLock(open);
  useEscapeKey(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menú">
      <div className="absolute inset-0 animate-fade-in bg-backdrop" onClick={onClose} />
      <nav className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col bg-surface pt-safe pb-safe shadow-2xl">
        <div className="flex items-center justify-between py-2 pr-2 pl-[max(1.25rem,env(safe-area-inset-left))]">
          <span className="text-xl font-bold">Balance</span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-11 items-center justify-center rounded-full text-muted active:bg-surface-2"
            aria-label="Cerrar menú"
          >
            <Icon name="close" />
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-1 px-3 pl-[max(0.75rem,env(safe-area-inset-left))]">
          {SECTIONS.map((section) => (
            <li key={section.path}>
              <NavLink
                to={section.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex h-12 items-center gap-3 rounded-xl px-3 text-base font-medium ${
                    isActive ? 'bg-accent/15 text-accent' : 'text-fg active:bg-surface-2'
                  }`
                }
              >
                <Icon name={section.icon} className="size-5" />
                {section.title}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>,
    document.body,
  );
}
