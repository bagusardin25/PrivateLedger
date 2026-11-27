// Currency metadata and money formatting rules. Pure: no browser API, so Node tests can import it.

/** Offered first in the currency picker: the currencies freelancers are most often paid or bank in. */
export const COMMON_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'IDR', 'INR', 'PHP', 'VND', 'THB', 'MYR', 'SGD', 'JPY', 'KRW', 'CNY', 'HKD', 'AUD', 'NZD', 'CAD',
  'MXN', 'BRL', 'ARS', 'COP', 'NGN', 'KES', 'ZAR', 'EGP', 'PKR', 'BDT', 'TRY', 'PLN', 'UAH', 'CHF', 'SEK', 'NOK', 'DKK',
  'AED', 'SAR',
] as const;

let supported: Set<string> | undefined;

/** Every ISO 4217 code this runtime can format. */
export function isCurrencyCode(code: string): boolean {
  supported ??= new Set(
    typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : COMMON_CURRENCIES,
  );
  return supported.has(code);
}

let names: Intl.DisplayNames | undefined;

/** "IDR" → "Indonesian Rupiah". */
export function currencyName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'currency' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Currencies whose minor unit exists on paper but is not used in everyday amounts. */
const WHOLE_UNITS_IN_PRACTICE = new Set(['IDR']);

/** Digits after the decimal mark: 2 for USD and EUR, 0 for IDR, JPY, KRW, VND. */
export function fractionDigits(code: string): number {
  if (WHOLE_UNITS_IN_PRACTICE.has(code)) return 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * The short symbol, unless it would be ambiguous: "Rp", "€", "₹", but "SGD" or
 * "A$" instead of a bare "$" that readers would take for US dollars.
 */
export function currencyDisplay(code: string): 'narrowSymbol' | 'symbol' {
  try {
    const narrow = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;
    if ((narrow === '$' && code !== 'USD') || (narrow === '¥' && code !== 'JPY')) return 'symbol';
  } catch {
    // Unknown code: the caller falls back to showing the code.
  }
  return 'narrowSymbol';
}
