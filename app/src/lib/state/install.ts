// Installing Private Ledger as an app (Chrome desktop, Android), plus the
// service worker that lets the installed app start offline.

import { createStore } from '../util/store';

/** Chrome's install event; not in the TypeScript DOM types yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const installStore = createStore<{ canInstall: boolean }>({ canInstall: false });

let deferred: BeforeInstallPromptEvent | undefined;

/** Call once at startup. Production only: in development a cached app would hide code changes. */
export function setUpInstall(): void {
  if (!('serviceWorker' in navigator)) return;

  if (import.meta.env.DEV) {
    // A worker left over from a production preview on the same port would serve old files.
    void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((r) => void r.unregister()));
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => console.warn('Offline support is not available:', error));
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    // Show the app's own Install button instead of Chrome's mini bar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    installStore.set({ canInstall: true });
  });

  window.addEventListener('appinstalled', () => {
    deferred = undefined;
    installStore.set({ canInstall: false });
  });
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  const event = deferred;
  deferred = undefined;
  installStore.set({ canInstall: false });
  await event.prompt();
  await event.userChoice;
}
