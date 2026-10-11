import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { backupRepo, useSetting } from '../../data';
import { daysSince, isBackupReminderDue, snoozeUntil } from '../../domain/backup';

/** Nudges the user to make a backup when the last one is a week old (or there is none). */
export function BackupReminder({ hasData }: { hasData: boolean }) {
  const lastBackupAt = useSetting('lastBackupAt');
  const snoozedUntil = useSetting('backupReminderSnoozedUntil');
  if (lastBackupAt === undefined || snoozedUntil === undefined) return null;

  const now = new Date();
  if (!isBackupReminderDue({ hasData, lastBackupAt, snoozedUntil, now })) return null;
  const days = daysSince(lastBackupAt, now);

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-surface p-4" role="status">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Icon name="shield" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">
          {days === null ? 'Aún no tienes ninguna copia de seguridad' : `Tu última copia es de hace ${days} días`}
        </p>
        <p className="mt-0.5 text-[13px] text-muted">Guárdala en iCloud Drive para no perder tus datos si le pasa algo al iPhone.</p>
        <div className="mt-2 flex gap-2">
          <Link to="/settings/backup" className="flex h-11 items-center rounded-xl bg-accent px-4 text-[15px] font-semibold text-white">
            Hacer copia
          </Link>
          <button
            type="button"
            onClick={() => void backupRepo.snoozeReminder(snoozeUntil(new Date()))}
            className="h-11 rounded-xl px-3 text-[15px] font-medium text-accent"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
