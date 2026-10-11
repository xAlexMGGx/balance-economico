import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Icon } from './Icon';

const UPDATE_CHECK_MS = 60 * 60 * 1000;
const OFFLINE_NOTICE_MS = 4000;

/**
 * Registers the service worker and tells the user when a new version is ready.
 * The new version only takes over when they tap "Actualizar".
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // iOS keeps installed apps in memory for days: look for a new version every hour
      // and every time the app comes back to the foreground.
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
    onRegisterError(error) {
      console.error('Service worker registration failed', error);
    },
  });

  // "Ready offline" is just a heads-up the first time; it goes away on its own.
  useEffect(() => {
    if (!offlineReady) return;
    const timer = window.setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  const dismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 z-40 mx-auto max-w-lg px-4 bottom-[calc(env(safe-area-inset-bottom)_+_5.75rem)]"
    >
      <div className="flex animate-pop-in items-center gap-2 rounded-2xl bg-fg py-2 pr-1 pl-4 text-canvas shadow-xl">
        <p className="flex-1 text-[15px]">{needRefresh ? 'Hay una versión nueva de la app.' : 'Lista para usarse sin conexión.'}</p>
        {needRefresh && (
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="h-11 shrink-0 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white"
          >
            Actualizar
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="flex size-11 shrink-0 items-center justify-center rounded-full opacity-70"
          aria-label={needRefresh ? 'Más tarde' : 'Cerrar'}
        >
          <Icon name="close" className="size-5" />
        </button>
      </div>
    </div>
  );
}
