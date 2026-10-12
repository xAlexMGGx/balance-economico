import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button, ListCard, Page, Switch } from '../../components/ui';
import {
  FaceIdError,
  isPasskeySupported,
  LOCK_AFTER_MS,
  MIN_PASSWORD_LENGTH,
  RepositoryError,
  securityRepo,
  useHasFaceId,
  useLockStatus,
  useSetting,
} from '../../data';
import { formatAgo } from '../backup/format';
import { HiddenUsername, PasswordInput } from './PasswordFields';

const LOCK_MINUTES = LOCK_AFTER_MS / 60_000;

function faceIdErrorMessage(error: unknown): string | null {
  if (error instanceof FaceIdError) {
    if (error.problem === 'cancelled') return null;
    if (error.problem === 'unsupported') return 'Este dispositivo no permite usar Face ID para desbloquear la app (hace falta iOS 18 o posterior).';
  }
  return error instanceof RepositoryError ? error.message : 'No se ha podido activar Face ID.';
}

export function SecurityPage() {
  const status = useLockStatus();
  const hasFaceId = useHasFaceId();
  const confirm = useConfirm();
  const [sheet, setSheet] = useState<'enable' | 'change' | 'disable' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (hasFaceId === undefined) return null;
  const enabled = status === 'unlocked';

  const enableFaceId = async () => {
    setMessage(null);
    setBusy(true);
    try {
      await securityRepo.enableFaceId();
      setMessage({ tone: 'ok', text: 'Face ID activado. La próxima vez podrás desbloquear la app con tu cara.' });
    } catch (error) {
      const text = faceIdErrorMessage(error);
      if (text) setMessage({ tone: 'error', text });
    } finally {
      setBusy(false);
    }
  };

  const toggleFaceId = async (on: boolean) => {
    if (on) return enableFaceId();
    const ok = await confirm({
      title: '¿Desactivar Face ID?',
      message: 'Tendrás que usar la contraseña. La passkey sigue en la app Contraseñas; puedes borrarla allí si quieres.',
      confirmLabel: 'Desactivar',
      destructive: true,
    });
    if (ok) await securityRepo.disableFaceId();
  };

  const afterEnabling = async () => {
    setSheet(null);
    setMessage({ tone: 'ok', text: 'Bloqueo activado. Tus datos ya están cifrados.' });
    if (!isPasskeySupported()) return;
    const wantsFaceId = await confirm({
      title: '¿Usar también Face ID?',
      message: 'Podrás desbloquear la app con tu cara. La contraseña seguirá sirviendo siempre.',
      confirmLabel: 'Usar Face ID',
      cancelLabel: 'Ahora no',
    });
    if (wantsFaceId) await enableFaceId();
  };

  return (
    <Page>
      {enabled ? (
        <>
          <section className="rounded-2xl bg-surface p-4">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Icon name="lock" className="size-5 text-income" />
              Bloqueo activado
            </p>
            <p className="mt-1 text-[15px] text-muted">
              La app se bloquea al abrirla y tras {LOCK_MINUTES} minutos fuera de ella. Tus datos están cifrados en este iPhone.
            </p>
          </section>

          <div className="mt-4">
            <ListCard>
              <li className="flex min-h-14 items-center gap-3 px-4 py-2">
                <Icon name="faceId" className="size-6 text-accent" />
                <span className="flex-1 text-[15px]">Desbloquear con Face ID</span>
                <Switch checked={hasFaceId} onChange={(on) => void toggleFaceId(on)} label="Desbloquear con Face ID" />
              </li>
            </ListCard>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <Button variant="secondary" onClick={() => securityRepo.lock()} disabled={busy}>
              <Icon name="lock" className="size-5" />
              Bloquear ahora
            </Button>
            <Button variant="secondary" onClick={() => setSheet('change')} disabled={busy}>
              Cambiar contraseña
            </Button>
            <Button variant="danger" className="mt-4" onClick={() => setSheet('disable')} disabled={busy}>
              Desactivar bloqueo
            </Button>
          </div>
        </>
      ) : (
        <DisabledIntro onEnable={() => setSheet('enable')} />
      )}

      {message && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-[15px] ${
            message.tone === 'ok' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
          }`}
        >
          {message.text}
        </p>
      )}

      {sheet === 'enable' && <EnableSheet onClose={() => setSheet(null)} onDone={() => void afterEnabling()} />}
      {sheet === 'change' && (
        <ChangePasswordSheet
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            setMessage({ tone: 'ok', text: 'Contraseña cambiada.' });
          }}
        />
      )}
      {sheet === 'disable' && (
        <DisableSheet
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            setMessage({ tone: 'ok', text: 'Bloqueo desactivado. Tus datos ya no están cifrados.' });
          }}
        />
      )}
    </Page>
  );
}

function DisabledIntro({ onEnable }: { onEnable: () => void }) {
  const lastBackupAt = useSetting('lastBackupAt');
  return (
    <>
      <section className="rounded-2xl bg-surface p-4">
        <p className="text-lg font-semibold">Protege tus datos</p>
        <p className="mt-1 text-[15px] text-muted">
          La app pedirá Face ID o tu contraseña al abrirse y tras {LOCK_MINUTES} minutos fuera. Tus datos se guardarán cifrados
          en el iPhone con una clave que sale de tu contraseña.
        </p>
      </section>

      <section className="mt-4 rounded-2xl bg-expense/10 p-4 text-[15px]">
        <p className="font-semibold text-expense">Antes de activarlo</p>
        <p className="mt-1">
          Si olvidas la contraseña y Face ID deja de funcionar, tus datos no se pueden recuperar. Haz una copia de seguridad
          primero.
        </p>
        <p className="mt-2 text-muted">
          {lastBackupAt ? `Tu última copia es de ${formatAgo(lastBackupAt, new Date())}.` : 'Todavía no has hecho ninguna copia.'}{' '}
          <Link to="/settings/backup" className="font-semibold text-accent">
            Hacer copia
          </Link>
        </p>
      </section>

      <Button className="mt-6 w-full" onClick={onEnable}>
        <Icon name="lock" className="size-5" />
        Activar bloqueo
      </Button>
    </>
  );
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof RepositoryError ? error.message : fallback;
}

function EnableSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = password.length >= MIN_PASSWORD_LENGTH && password === repeat;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await securityRepo.enable(password);
      onDone();
    } catch (e) {
      setError(errorText(e, 'No se ha podido activar el bloqueo. Tus datos no se han tocado.'));
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={busy ? () => {} : onClose}
      title="Activar bloqueo"
      footer={
        <Button className="w-full" disabled={!valid || busy} onClick={() => void submit()}>
          {busy ? 'Cifrando tus datos…' : 'Activar y cifrar'}
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 pt-1">
        <HiddenUsername />
        <PasswordInput
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres. Una frase que recuerdes es una buena opción, o deja que el iPhone sugiera una y la guarde.`}
        />
        <PasswordInput label="Repite la contraseña" value={repeat} onChange={setRepeat} autoComplete="new-password" />
        {repeat && password !== repeat && <p className="text-[13px] text-expense">Las contraseñas no coinciden.</p>}
        {error && <p className="text-sm text-expense">{error}</p>}
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}

function ChangePasswordSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = current !== '' && next.length >= MIN_PASSWORD_LENGTH && next === repeat;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await securityRepo.changePassword(current, next);
      onDone();
    } catch (e) {
      setError(errorText(e, 'No se ha podido cambiar la contraseña.'));
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Cambiar contraseña"
      footer={
        <Button className="w-full" disabled={!valid || busy} onClick={() => void submit()}>
          Cambiar
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 pt-1">
        <HiddenUsername />
        <PasswordInput label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordInput
          label="Contraseña nueva"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}
        />
        <PasswordInput label="Repite la contraseña nueva" value={repeat} onChange={setRepeat} autoComplete="new-password" />
        {repeat && next !== repeat && <p className="text-[13px] text-expense">Las contraseñas no coinciden.</p>}
        {error && <p className="text-sm text-expense">{error}</p>}
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}

function DisableSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await securityRepo.disable(password);
      onDone();
    } catch (e) {
      setError(errorText(e, 'No se ha podido desactivar el bloqueo.'));
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={busy ? () => {} : onClose}
      title="Desactivar bloqueo"
      footer={
        <Button variant="danger" className="w-full" disabled={!password || busy} onClick={() => void submit()}>
          {busy ? 'Descifrando…' : 'Desactivar'}
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 pt-1">
        <p className="text-[15px] text-muted">
          La app dejará de pedir Face ID o contraseña y tus datos se guardarán sin cifrar en el iPhone.
        </p>
        <HiddenUsername />
        <PasswordInput label="Contraseña" value={password} onChange={setPassword} autoComplete="current-password" />
        {error && <p className="text-sm text-expense">{error}</p>}
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}
