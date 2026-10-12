import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { useConfirm } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/ui';
import { FaceIdError, securityRepo, useHasFaceId } from '../../data';
import { HiddenUsername, PasswordInput } from './PasswordFields';

const FACE_ID_MESSAGES = {
  unsupported: 'Face ID no está disponible ahora. Usa la contraseña.',
  failed: 'No se ha podido usar Face ID. Usa la contraseña.',
  wrong: 'Face ID no ha podido desbloquear la app. Usa la contraseña.',
} as const;

/** Full screen shown while the app is locked: Face ID or password. */
export function LockScreen() {
  const hasFaceId = useHasFaceId();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const triedFaceId = useRef(false);

  const unlockWithFaceId = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!(await securityRepo.unlockWithFaceId())) setError(FACE_ID_MESSAGES.wrong);
    } catch (e) {
      if (!(e instanceof FaceIdError && e.problem === 'cancelled')) {
        setError(e instanceof FaceIdError ? FACE_ID_MESSAGES[e.problem as 'unsupported' | 'failed'] : FACE_ID_MESSAGES.failed);
      }
    } finally {
      setBusy(false);
    }
  };

  // Offer Face ID straight away. If iOS wants a tap first, it refuses quietly and the button is there.
  useEffect(() => {
    if (hasFaceId && !triedFaceId.current && document.visibilityState === 'visible') {
      triedFaceId.current = true;
      void unlockWithFaceId();
    }
  }, [hasFaceId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setError(null);
    setBusy(true);
    const ok = await securityRepo.unlockWithPassword(password);
    setBusy(false);
    if (!ok) {
      setError('Contraseña incorrecta.');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-canvas pt-safe pb-safe px-safe">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <div className="flex flex-col items-center text-center">
          <img src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" className="size-20 rounded-[22px] shadow-md" />
          <h1 className="mt-4 text-2xl font-bold">Balance</h1>
          <p className="mt-1 flex items-center gap-1.5 text-[15px] text-muted">
            <Icon name="lock" className="size-4" />
            La app está bloqueada
          </p>
        </div>

        {hasFaceId && (
          <Button className="mt-8 w-full" onClick={() => void unlockWithFaceId()} disabled={busy}>
            <Icon name="faceId" className="size-6" />
            Desbloquear con Face ID
          </Button>
        )}

        <form onSubmit={(event) => void submit(event)} className={`flex flex-col gap-3 ${hasFaceId ? 'mt-6' : 'mt-8'}`}>
          <HiddenUsername />
          <PasswordInput
            label={hasFaceId ? 'O con tu contraseña' : 'Contraseña'}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            autoFocus={hasFaceId === false}
          />
          <Button type="submit" variant={hasFaceId ? 'secondary' : 'primary'} className="w-full" disabled={!password || busy}>
            Desbloquear
          </Button>
        </form>

        <p role="alert" className="mt-3 min-h-6 text-center text-[15px] text-expense">
          {error}
        </p>

        <button type="button" onClick={() => setForgotOpen(true)} className="mx-auto mt-4 h-11 px-4 text-[15px] text-accent">
          ¿Has olvidado la contraseña?
        </button>
      </div>

      {forgotOpen && <ForgotPasswordSheet onClose={() => setForgotOpen(false)} />}
    </div>
  );
}

function ForgotPasswordSheet({ onClose }: { onClose: () => void }) {
  const confirm = useConfirm();

  const erase = async () => {
    const ok = await confirm({
      title: '¿Borrar todos los datos?',
      message: 'Se borrarán todas tus cuentas, movimientos y ajustes de este iPhone. Después podrás importar una copia de seguridad.',
      confirmLabel: 'Borrar todo',
      destructive: true,
    });
    if (!ok) return;
    await securityRepo.eraseEverything();
    window.location.reload();
  };

  return (
    <BottomSheet open onClose={onClose} title="¿Has olvidado la contraseña?">
      <div className="flex flex-col gap-4 pt-1 text-[15px]">
        <p>
          Tus datos están cifrados con tu contraseña. Sin ella ni Face ID no hay forma de leerlos: nadie puede recuperarlos.
        </p>
        <p className="text-muted">
          Prueba antes las contraseñas que suelas usar, o búscala en la app Contraseñas si dejaste que el iPhone la guardara.
        </p>
        <p className="text-muted">
          Si no la encuentras, puedes borrar todo y empezar de nuevo, y después importar tu última copia de seguridad desde
          Ajustes › Copia de seguridad.
        </p>
        <Button variant="danger" onClick={() => void erase()}>
          <Icon name="trash" className="size-5" />
          Borrar todos los datos
        </Button>
      </div>
    </BottomSheet>
  );
}
