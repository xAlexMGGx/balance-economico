import { Link } from 'react-router';
import { Icon, type IconName } from '../../components/Icon';
import { ListCard, Page } from '../../components/ui';
import { useAccounts, useCategories, useGroups, useRecurringRules, useTags } from '../../data';

export function SettingsPage() {
  const accounts = useAccounts();
  const groups = useGroups();
  const categories = useCategories();
  const tags = useTags();
  const rules = useRecurringRules();

  return (
    <Page>
      <ListCard>
        <SettingsLink to="/settings/accounts" icon="wallet" label="Cuentas" count={accounts?.length} />
        <SettingsLink to="/settings/groups" icon="folder" label="Grupos" count={groups?.length} />
        <SettingsLink to="/settings/categories" icon="grid" label="Categorías" count={categories?.length} />
        <SettingsLink to="/settings/tags" icon="tag" label="Tags" count={tags?.length} />
      </ListCard>
      <div className="mt-6">
        <ListCard>
          <SettingsLink to="/settings/recurring" icon="repeat" label="Movimientos recurrentes" count={rules?.length} />
        </ListCard>
      </div>
    </Page>
  );
}

function SettingsLink({ to, icon, label, count }: { to: string; icon: IconName; label: string; count?: number }) {
  return (
    <li>
      <Link to={to} className="flex min-h-12 items-center gap-3 px-4 py-2.5 active:bg-surface-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-white">
          <Icon name={icon} className="size-[18px]" />
        </span>
        <span className="flex-1 text-[15px]">{label}</span>
        {count !== undefined && <span className="text-[15px] text-muted tabular-nums">{count}</span>}
        <Icon name="chevronRight" className="size-5 text-muted" />
      </Link>
    </li>
  );
}
