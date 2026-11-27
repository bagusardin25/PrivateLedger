// Merchant normalization (labeling step 1). Bank descriptions carry store numbers,
// transaction IDs, phone numbers, and payment-processor prefixes, so the same
// merchant shows up under many strings. Normalizing first lets merchant memory,
// rules, and the on-device model work once per merchant instead of once per row.

const PROCESSOR_PREFIXES = new Set(['SQ', 'TST', 'PP', 'SP', 'POS', 'DEBIT', 'CHKCARD', 'CHECKCARD', 'PURCHASE', 'ACH', 'CARD']);
/**
 * Card and transfer words that Indonesian and European banks write before the
 * merchant ("KARTU DEBIT GRAB", "TRSF E-BANKING DB 0710/FTSCY/WS95031 NAME",
 * "SEPA LASTSCHRIFT"). Without this every card purchase would share one key.
 */
const BANK_PREFIXES = new Set([
  'KARTU', 'KREDIT', 'TRSF', 'TRANSAKSI', 'E-BANKING', 'EBANKING', 'BI-FAST', 'BIFAST', 'SWITCHING', 'DOMESTIK', 'TARIKAN',
  'QRIS', 'FTSCY', 'FTFVA', 'MCM', 'INHOUSE', 'SEPA', 'LASTSCHRIFT', 'UEBERWEISUNG', 'ÜBERWEISUNG', 'KARTENZAHLUNG', 'PRLV',
  'VIR', 'CB', 'BIF',
]);
/** Direction codes that follow those prefixes: credit/debit, to/from, date. */
const AFTER_PREFIX = new Set(['CR', 'DB', 'DR', 'KR', 'KE', 'DARI', 'TGL', 'TRANSFER']);
/** A reference such as 0110 or WS95031: letters and digits only, with at least one digit. */
const REFERENCE = /^[A-Z0-9]*\d[A-Z0-9]*$/;
const NOISE = new Set([
  'MKTP', 'MKT', 'STORE', 'WHSE', 'INC', 'CO', 'CORP', 'THE', 'WEB', 'ONLINE', 'US', 'USA',
  'TO', 'FROM', 'FOR', 'OF', 'AND', 'AT',
  // Indonesian company forms and connecting words: PT Gojek Indonesia Tbk, transfer ke, dari.
  'PT', 'TBK', 'KE', 'DARI',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'SEPT', 'OCT', 'NOV', 'DEC',
]);
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
]);

export interface Merchant {
  /** Stable key for grouping and merchant memory, e.g. "WHOLE FOODS". */
  key: string;
  /** Readable name for the table, e.g. "Whole Foods". */
  name: string;
}

function titleCase(word: string, index: number): string {
  // A short first word, or anything with "&", is usually an acronym: IRS, AMC, CVS, B&H, PG&E.
  if ((index === 0 && word.length <= 3) || word.includes('&')) return word;
  return word.charAt(0) + word.slice(1).toLowerCase();
}

export function normalizeMerchant(description: string): Merchant {
  const tokens = description
    .toUpperCase()
    .replace(/\.(COM|NET|ORG|US|IO)\b/g, ' ')
    .replace(/[*#/,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((t) => t.replace(/^[.'-]+|[.'-]+$/g, ''))
    .filter(Boolean);

  // Drop processor and bank prefixes at the start (SQ *, TST*, CHKCARD 1029, KARTU DEBIT, TRSF E-BANKING DB 0710 ...),
  // and the direction codes and reference numbers that come right after them.
  let stripped = false;
  while (tokens.length > 1) {
    const token = tokens[0];
    const prefix = PROCESSOR_PREFIXES.has(token) || BANK_PREFIXES.has(token);
    if (!prefix && !(stripped && (AFTER_PREFIX.has(token) || REFERENCE.test(token)))) break;
    tokens.shift();
    stripped = true;
  }

  let words = tokens.filter((t) => !/\d/.test(t) && t.length > 1 && !NOISE.has(t));
  // A trailing two-letter state code ("... 800-833-6687 CA") is location, not merchant.
  if (words.length > 1 && US_STATES.has(words[words.length - 1])) words = words.slice(0, -1);
  if (words.length === 0) words = tokens.slice(0, 2);

  const key = words.slice(0, 2).join(' ') || description.trim().toUpperCase();
  const name = words.slice(0, 3).map(titleCase).join(' ') || description.trim();
  return { key, name };
}
