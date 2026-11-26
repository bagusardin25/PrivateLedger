// Merchant normalization (labeling step 1). Bank descriptions carry store numbers,
// transaction IDs, phone numbers, and payment-processor prefixes, so the same
// merchant shows up under many strings. Normalizing first lets merchant memory,
// rules, and the on-device model work once per merchant instead of once per row.

const PROCESSOR_PREFIXES = new Set(['SQ', 'TST', 'PP', 'SP', 'POS', 'DEBIT', 'CHKCARD', 'CHECKCARD', 'PURCHASE', 'ACH', 'CARD']);
const NOISE = new Set([
  'MKTP', 'MKT', 'STORE', 'WHSE', 'INC', 'CO', 'CORP', 'THE', 'WEB', 'ONLINE', 'US', 'USA',
  'TO', 'FROM', 'FOR', 'OF', 'AND', 'AT',
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

  // Drop processor prefixes at the start (SQ *, TST*, CHKCARD 1029 ...).
  while (tokens.length > 1 && PROCESSOR_PREFIXES.has(tokens[0])) tokens.shift();

  let words = tokens.filter((t) => !/\d/.test(t) && t.length > 1 && !NOISE.has(t));
  // A trailing two-letter state code ("... 800-833-6687 CA") is location, not merchant.
  if (words.length > 1 && US_STATES.has(words[words.length - 1])) words = words.slice(0, -1);
  if (words.length === 0) words = tokens.slice(0, 2);

  const key = words.slice(0, 2).join(' ') || description.trim().toUpperCase();
  const name = words.slice(0, 3).map(titleCase).join(' ') || description.trim();
  return { key, name };
}
