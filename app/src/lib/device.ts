import { useSyncExternalStore } from 'react';
import { initializeOnDeviceModel } from './labeler';
import { runOnDeviceLabeling } from './labelingRunner';
import { getDeviceStatus, type DeviceStatus } from './onDevice';
import { createStore } from './store';

export interface DeviceState {
  status: DeviceStatus | 'checking';
  downloading: boolean;
  /** 0–1 while the model downloads. */
  progress?: number;
  error?: string;
}

export const deviceStore = createStore<DeviceState>({ status: 'checking', downloading: false });

export async function refreshDeviceStatus(): Promise<void> {
  deviceStore.set({ status: await getDeviceStatus() });
}

/** Call straight from a click handler: Chrome only starts the download with user activation. */
export async function enableOnDeviceAi(): Promise<void> {
  deviceStore.set({ downloading: true, progress: 0, error: undefined });
  try {
    await initializeOnDeviceModel((value) => deviceStore.set({ progress: value }));
  } catch (error) {
    deviceStore.set({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    deviceStore.set({ downloading: false });
    await refreshDeviceStatus();
  }
  // Rows that were waiting for the model start as soon as it is ready.
  if (deviceStore.get().status === 'available') void runOnDeviceLabeling();
}

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
