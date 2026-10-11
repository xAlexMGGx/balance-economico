import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useTransactionSheet } from '../../features/transactions/TransactionSheetProvider';
import { SECTIONS, SUBPAGES } from '../../routes';
import { Icon } from '../Icon';
import { SideMenu } from './SideMenu';

const headerButton = 'flex size-11 items-center justify-center rounded-full text-fg active:bg-surface-2';

export function AppLayout() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { openNew } = useTransactionSheet();

  const subpage = SUBPAGES[pathname];
  const title = subpage?.title ?? SECTIONS.find((s) => pathname.startsWith(s.path))?.title ?? '';

  return (
    <div className="min-h-dvh px-safe">
      <header className="sticky top-0 z-20 bg-canvas/85 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-1 px-2">
          {subpage ? (
            <Link to={subpage.parent} className={headerButton} aria-label="Volver">
              <Icon name="back" />
            </Link>
          ) : (
            <button type="button" className={headerButton} onClick={() => setMenuOpen(true)} aria-label="Abrir menú">
              <Icon name="menu" />
            </button>
          )}
          <h1 className="truncate text-xl font-bold">{title}</h1>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <button
        type="button"
        onClick={() => openNew()}
        className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(env(safe-area-inset-bottom)_+_1.25rem)] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-black/25 transition-transform active:scale-95"
        aria-label="Añadir movimiento"
      >
        <Icon name="plus" className="size-7" />
      </button>

      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
