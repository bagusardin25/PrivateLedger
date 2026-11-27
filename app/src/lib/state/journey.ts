// The product journey: Import → Label on device → Review → Export.
// Every step's state comes from local data, so the stepper is always truthful.

import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';
import { db } from '../data/db';

const EXPORT_KEY = 'private-ledger:lastExportAt';
const exportListeners = new Set<() => void>();

function emitExport() {
  exportListeners.forEach((listener) => listener());
}

/** Only a timestamp is stored, so the stepper can show that the export step is done. */
export function markExported(): void {
  localStorage.setItem(EXPORT_KEY, String(Date.now()));
  emitExport();
}

export function clearExported(): void {
  localStorage.removeItem(EXPORT_KEY);
  emitExport();
}

function subscribeExport(listener: () => void) {
  exportListeners.add(listener);
  // clearAllData() in db.ts announces the reset with this event (db.ts cannot import this module).
  window.addEventListener('private-ledger:export-changed', listener);
  return () => {
    exportListeners.delete(listener);
    window.removeEventListener('private-ledger:export-changed', listener);
  };
}

export function useLastExport(): number | undefined {
  const raw = useSyncExternalStore(subscribeExport, () => localStorage.getItem(EXPORT_KEY), () => null);
  return raw ? Number(raw) : undefined;
}

export interface JourneyCounts {
  total: number;
  waiting: number;
  review: number;
}

export function useJourneyCounts(): JourneyCounts | undefined {
  return useLiveQuery(async () => {
    const all = await db.transactions.toArray();
    return {
      total: all.length,
      waiting: all.filter((t) => t.source === 'pending').length,
      review: all.filter((t) => t.needsReview).length,
    };
  }, []);
}
