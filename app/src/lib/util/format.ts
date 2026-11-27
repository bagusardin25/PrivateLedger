import { currencyDisplay, fractionDigits } from './currency';
import { getLedgerCurrency } from './ledgerCurrency';

/** Digit grouping follows the browser's language, so "Rp 1.500.000" for id-ID and "Rp 1,500,000" for en-US. */
function numberLocale(): string {
  const preferred = typeof navigator === 'undefined' ? undefined : navigator.language;
  try {
    return preferred && Intl.NumberFormat.supportedLocalesOf(preferred).length ? preferred : 'en-US';
  } catch {
    return 'en-US';
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

function moneyFormat(currency: string): Intl.NumberFormat {
  let format = formatters.get(currency);
  if (!format) {
    const digits = fractionDigits(currency);
    try {
      format = new Intl.NumberFormat(numberLocale(), {
        style: 'currency',
        currency,
        currencyDisplay: currencyDisplay(currency),
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    } catch {
      format = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    }
    formatters.set(currency, format);
  }
  return format;
}

/** Formats in the ledger's currency unless another one is given (the import preview). */
export function formatMoney(amount: number, currency: string = getLedgerCurrency()): string {
  return moneyFormat(currency).format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-10-05" → "Oct 5". Anything that is not an ISO date is shown as given. */
export function formatShortDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : shortDate.format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? word : many}`;
}
