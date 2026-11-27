// The currency of the transactions on this device. A ledger holds one currency:
// amounts in different currencies cannot be added up without an exchange rate,
// and fetching rates would mean a network call this app does not make.
// Only the three-letter code is kept, in localStorage, next to the data it describes.

import { createStore } from './store';

const KEY = 'private-ledger:currency';
/** Data imported before currencies were tracked was always USD. */
const FALLBACK = 'USD';

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export const ledgerCurrencyStore = createStore<{ code: string }>({ code: typeof localStorage === 'undefined' ? FALLBACK : read() });

export function getLedgerCurrency(): string {
  return ledgerCurrencyStore.get().code;
}

export function setLedgerCurrency(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // Storage may be unavailable; the code still applies for this session.
  }
  ledgerCurrencyStore.set({ code });
}

export function resetLedgerCurrency(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore storage failures.
  }
  ledgerCurrencyStore.set({ code: FALLBACK });
}
