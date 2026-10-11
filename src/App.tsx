import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ConfirmProvider } from './components/ConfirmDialog';
import { AppLayout } from './components/layout/AppLayout';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { CalendarPage } from './features/calendar/CalendarPage';
import { AccountsPage } from './features/settings/AccountsPage';
import { CategoriesPage } from './features/settings/CategoriesPage';
import { GroupsPage } from './features/settings/GroupsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TagsPage } from './features/settings/TagsPage';
import { AccountFilterProvider } from './features/transactions/AccountFilterProvider';
import { TransactionSheetProvider } from './features/transactions/TransactionSheetProvider';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { DEFAULT_PATH } from './routes';

export function App() {
  return (
    <HashRouter>
      <ConfirmProvider>
        <AccountFilterProvider>
          <TransactionSheetProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to={DEFAULT_PATH} replace />} />
                <Route path="analysis" element={<AnalysisPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="settings/accounts" element={<AccountsPage />} />
                <Route path="settings/groups" element={<GroupsPage />} />
                <Route path="settings/categories" element={<CategoriesPage />} />
                <Route path="settings/tags" element={<TagsPage />} />
                <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
              </Route>
            </Routes>
          </TransactionSheetProvider>
        </AccountFilterProvider>
      </ConfirmProvider>
    </HashRouter>
  );
}
