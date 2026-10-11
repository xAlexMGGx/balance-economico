import type { IconName } from './components/Icon';

export interface Section {
  path: string;
  title: string;
  icon: IconName;
}

/** Sections shown in the side menu, in order. */
export const SECTIONS: Section[] = [
  { path: '/analysis', title: 'Análisis', icon: 'chart' },
  { path: '/calendar', title: 'Calendario', icon: 'calendar' },
  { path: '/transactions', title: 'Movimientos', icon: 'list' },
  { path: '/settings', title: 'Ajustes', icon: 'settings' },
];

/** Screens inside a section. They show a back button instead of the menu button. */
export const SUBPAGES: Record<string, { title: string; parent: string }> = {
  '/settings/accounts': { title: 'Cuentas', parent: '/settings' },
  '/settings/groups': { title: 'Grupos', parent: '/settings' },
  '/settings/categories': { title: 'Categorías', parent: '/settings' },
  '/settings/tags': { title: 'Tags', parent: '/settings' },
};

export const DEFAULT_PATH = '/transactions';
