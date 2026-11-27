// Works out which currency a bank CSV is in, from the file alone. Pure: tested in scripts/csv.test.ts.
//
// Evidence, strongest first:
//   1. a currency column ("Currency", "Mata Uang") holding codes such as IDR or EUR
//   2. symbols or codes written in the amounts ("Rp 85.000", "1.234,56 €", "USD 20")
//   3. a code or symbol in a column name ("Amount (EUR)", "Jumlah (Rp)")
// A bare "$" or "¥" is shared by several currencies, so it only counts as a low-confidence guess.

import { isCurrencyCode } from '../util/currency.ts';

export type CurrencyConfidence = 'high' | 'low' | 'none';

export interface CurrencyGuess {
  code?: string;
  confidence: CurrencyConfidence;
  source: 'column' | 'amounts' | 'header' | 'none';
  /** The currency column, when the file has one. */
  column?: string;
  /** Every currency named in that column, most frequent first. More than one means a mixed file. */
  codes: string[];
}

/** Longer, more specific symbols first so "S$" is not read as "$". */
const SYMBOLS: [RegExp, string, CurrencyConfidence][] = [
  [/(?<![A-Za-z])US\$/, 'USD', 'high'],
  [/(?<![A-Za-z])S\$/, 'SGD', 'high'],
  [/(?<![A-Za-z])AU?\$/, 'AUD', 'high'],
  [/(?<![A-Za-z])CA?\$/, 'CAD', 'high'],
  [/(?<![A-Za-z])NZ\$/, 'NZD', 'high'],
  [/(?<![A-Za-z])HK\$/, 'HKD', 'high'],
  [/(?<![A-Za-z])R\$/, 'BRL', 'high'],
  [/(?<![A-Za-z])MX\$/, 'MXN', 'high'],
  [/(?<![A-Za-z])Rp(?![A-Za-z])/i, 'IDR', 'high'],
  [/(?<![A-Za-z])RM(?![A-Za-z])/, 'MYR', 'high'],
  [/€/, 'EUR', 'high'],
  [/£/, 'GBP', 'high'],
  [/₹/, 'INR', 'high'],
  [/₱/, 'PHP', 'high'],
  [/₫/, 'VND', 'high'],
  [/฿/, 'THB', 'high'],
  [/₩/, 'KRW', 'high'],
  [/₦/, 'NGN', 'high'],
  [/₺/, 'TRY', 'high'],
  [/৳/, 'BDT', 'high'],
  [/₴/, 'UAH', 'high'],
  [/zł/i, 'PLN', 'high'],
  [/¥/, 'JPY', 'low'],
  [/\$/, 'USD', 'low'],
];

/** Real ISO codes that are also everyday words in column names or notes. */
const CODE_LOOKALIKES = new Set(['ALL', 'TOP', 'CUP', 'MOP', 'BOB', 'SOS', 'MAD', 'PEN', 'TRY']);

const CURRENCY_COLUMN = /^(currency( code)?|ccy|curr\.?|cur|mata ?uang|valuta|währung|devise|moneda|moeda|valuuta)$/i;

/** The currency a short text names, e.g. "IDR", "Rp 85.000", "1.234,56 €", "(EUR)". */
export function currencyInText(text: string | undefined): { code: string; confidence: CurrencyConfidence } | undefined {
  if (!text) return undefined;
  for (const match of text.matchAll(/(?<![A-Za-z])([A-Za-z]{3})(?![A-Za-z])/g)) {
    const word = match[1];
    const code = word.toUpperCase();
    // Lower-case "try" or "all" is a word; upper-case TRY next to a number is the lira.
    if (CODE_LOOKALIKES.has(code) && (word !== code || !/\d/.test(text))) continue;
    if (word === code && isCurrencyCode(code)) return { code, confidence: 'high' };
  }
  for (const [pattern, code, confidence] of SYMBOLS) if (pattern.test(text)) return { code, confidence };
  return undefined;
}

function tally(values: (string | undefined)[]) {
  const counts = new Map<string, { n: number; confidence: CurrencyConfidence }>();
  for (const value of values) {
    const found = currencyInText(value);
    if (!found) continue;
    const entry = counts.get(found.code) ?? { n: 0, confidence: found.confidence };
    entry.n += 1;
    counts.set(found.code, entry);
  }
  return [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
}

export function detectCurrency(headers: string[], rows: Record<string, string>[], amountColumns: string[]): CurrencyGuess {
  const sample = rows.slice(0, 300);

  const column = headers.find((h) => CURRENCY_COLUMN.test(h.trim()));
  if (column) {
    const ranked = tally(sample.map((r) => r[column]));
    if (ranked.length) {
      return { code: ranked[0][0], confidence: 'high', source: 'column', column, codes: ranked.map(([code]) => code) };
    }
  }

  const inAmounts = tally(sample.flatMap((r) => amountColumns.filter(Boolean).map((c) => r[c])));
  if (inAmounts.length) {
    const [code, { confidence }] = inAmounts[0];
    return { code, confidence, source: 'amounts', column, codes: [] };
  }

  const named = tally([...amountColumns.filter(Boolean), ...headers]);
  if (named.length) {
    const [code, { confidence }] = named[0];
    return { code, confidence, source: 'header', column, codes: [] };
  }

  return { confidence: 'none', source: 'none', column, codes: [] };
}

const EURO_AREA = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', ID: 'IDR', GB: 'GBP', IN: 'INR', PH: 'PHP', VN: 'VND', TH: 'THB', MY: 'MYR', SG: 'SGD', JP: 'JPY', KR: 'KRW',
  CN: 'CNY', HK: 'HKD', AU: 'AUD', NZ: 'NZD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CO: 'COP', NG: 'NGN', KE: 'KES',
  ZA: 'ZAR', EG: 'EGP', PK: 'PKR', BD: 'BDT', TR: 'TRY', PL: 'PLN', UA: 'UAH', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  AE: 'AED', SA: 'SAR',
  ...Object.fromEntries(EURO_AREA.map((region) => [region, 'EUR'])),
};

/** "id-ID" → "IDR", "de-DE" → "EUR". Undefined when the locale names no region this app maps. */
export function currencyForLocale(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  try {
    const region = new Intl.Locale(locale).maximize().region;
    return region ? REGION_CURRENCY[region] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The currency to preselect. A file that names its currency wins; a bare "$"
 * means the local dollar when the browser's region uses one; otherwise the
 * browser's region decides, and US dollars are the last resort.
 */
export function pickCurrency(guess: CurrencyGuess, locale: string | undefined): string {
  const local = currencyForLocale(locale);
  if (guess.code && guess.confidence === 'high') return guess.code;
  if (guess.code === 'USD' && local && ['AUD', 'CAD', 'SGD', 'NZD', 'HKD', 'MXN', 'ARS', 'COP'].includes(local)) return local;
  if (guess.code === 'JPY' && local === 'CNY') return local;
  return guess.code ?? local ?? 'USD';
}
