import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, Page } from '../../components/ui';
import { backupRepo, useBackupData, useLockStatus, useSetting } from '../../data';
import {
  BACKUP_REMINDER_DAYS,
  backupFileName,
  createBackup,
  parseBackup,
  summarizeBackup,
  type BackupFile,
} from '../../domain/backup';
import { describeSummary, formatAgo, formatTimestamp } from './format';
import { saveFile } from './saveFile';

type Message = { tone: 'ok' | 'error'; text: string };

export function BackupPage() {
  const data = useBackupData();
  const lastBackupAt = useSetting('lastBackupAt');
  const lockStatus = useLockStatus();
  const confirm = useConfirm();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);

  // The file is ready before the tap: iOS only opens the share sheet straight from a tap.
  const file = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    return new File([JSON.stringify(createBackup(data, now), null, 2)], backupFileName(now), { type: 'application/json' });
  }, [data]);

  if (!data || lastBackupAt === undefined || !file) return null;
  const current = summarizeBackup(data);

  const exportBackup = async () => {
    setMessage(null);
    const result = await saveFile(file);
    if (result === 'cancelled') return;
    await backupRepo.markExported(new Date());
    setMessage({
      tone: 'ok',
      text:
        result === 'shared'
          ? 'Copia hecha. Si la guardaste en Archivos › iCloud Drive, ya está a salvo fuera del iPhone.'
          : 'Copia descargada.',
    });
  };

  const importBackup = async (backup: BackupFile) => {
    const summary = describeSummary(summarizeBackup(backup.data));
    const ok = await confirm({
      title: '¿Sustituir todos tus datos?',
      message: `Se borrará lo que hay ahora (${describeSummary(current)}) y se pondrá lo de la copia del ${formatTimestamp(
        backup.exportedAt,
      )}: ${summary}. No se puede deshacer: si quieres conservar lo actual, cancela y haz antes una copia.`,
      confirmLabel: 'Sustituir',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await backupRepo.replaceAll(backup.data, backup.exportedAt);
      setMessage({ tone: 'ok', text: `Datos restaurados de la copia del ${formatTimestamp(backup.exportedAt)}.` });
    } catch {
      setMessage({ tone: 'error', text: 'No se ha podido importar la copia. Tus datos no se han tocado.' });
    } finally {
      setBusy(false);
    }
  };

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    setMessage(null);
    const result = parseBackup(await chosen.text());
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error });
      return;
    }
    await importBackup(result.backup);
  };

  return (
    <Page>
      <section className="rounded-2xl bg-surface p-4">
        <p className="text-[13px] text-muted">Última copia</p>
        <p className="mt-0.5 text-lg font-semibold">
          {lastBackupAt ? `${capitalize(formatAgo(lastBackupAt, new Date()))} · ${formatTimestamp(lastBackupAt)}` : 'Todavía ninguna'}
        </p>
        <p className="mt-1 text-[13px] text-muted">Ahora tienes {describeSummary(current)}.</p>
        <Button className="mt-4 w-full" onClick={() => void exportBackup()} disabled={busy}>
          <Icon name="upload" className="size-5" />
          Hacer copia
        </Button>
      </section>

      {message && (
        <p
          role="status"
          className={`mt-3 rounded-xl px-4 py-3 text-[15px] ${
            message.tone === 'ok' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 rounded-2xl bg-surface p-4 text-[15px]">
        <p className="font-semibold">Para guardarla en iCloud</p>
        <p className="mt-1 text-muted">
          Al hacer la copia, elige <span className="text-fg">Guardar en Archivos</span> y una carpeta de iCloud Drive. La
          app no puede subirla a iCloud por su cuenta; te recordará hacer una copia si pasan más de {BACKUP_REMINDER_DAYS}{' '}
          días.
        </p>
        {lockStatus === 'unlocked' && (
          <p className="mt-2 text-muted">
            La copia no va cifrada: quien tenga el archivo puede leer tus datos. Guárdala en un sitio tuyo, como tu iCloud
            Drive.
          </p>
        )}
      </div>

      <section className="mt-6">
        <Button variant="secondary" className="w-full" onClick={() => fileInput.current?.click()} disabled={busy}>
          <Icon name="download" className="size-5" />
          Importar copia…
        </Button>
        <p className="mt-2 px-1 text-[13px] text-muted">
          Sustituye todos los datos de la app por los de un archivo de copia. Antes te enseña qué contiene y te pide
          confirmación.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void onFileChosen(event)}
          aria-label="Archivo de copia"
        />
      </section>
    </Page>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
