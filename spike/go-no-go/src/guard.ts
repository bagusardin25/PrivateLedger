// Layer 1 of the outgoing-message guard (F9a): deterministic checks that run
// without any model. Layer 2 (the on-device classifier) lives in tests.ts.
//
// Caveat: these rules were written alongside the test messages in data.ts, so
// their score here is optimistic. Treat it as a smoke test, not a benchmark.

const COMMON_WORDS = new Set([
  'ANNUAL', 'APPLE', 'CLOUD', 'COPAY', 'CREATIVE', 'DELTA', 'DESIGN', 'FITNESS', 'FOODS', 'IMAGES',
  'LINES', 'MEDIA', 'MEMBERSHIP', 'MONTHLY', 'ONLINE', 'PAYMENT', 'PHARMACY', 'PHOTO', 'PLANET',
  'PRINTER', 'PROPERTY', 'RENEWAL', 'SAVINGS', 'SERVICE', 'SHELL', 'STORE', 'STUDIO', 'SUBSCRIPTION',
  'TABLET', 'TARGET', 'THEATRES', 'TRADER', 'TRANSFER', 'VIDEO', 'WHOLE', 'WORKSPACE',
]);

const CURRENCY_AMOUNT = /[$€£]\s?\d[\d,]*(?:\.\d{1,2})?/;
const DECIMAL_AMOUNT = /(?<![\d.])[-+]?\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)|(?<![\d.])[-+]?\d+\.\d{2}(?!\d)/;
const BARE_NUMBER = /\b\d{2,}\b/;
const DATE =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;
/** Two or more consecutive upper-case tokens, the way statement lines are written. */
const STATEMENT_STYLE = /\b[A-Z][A-Z0-9&*.'\/-]{2,}(?:\s+[A-Z0-9&*.'\/#-]{2,})+/;

export function merchantTokens(descriptions: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const description of descriptions) {
    for (const word of description.toUpperCase().split(/[^A-Z]+/)) {
      if (word.length >= 5 && !COMMON_WORDS.has(word)) tokens.add(word);
    }
  }
  return tokens;
}

export interface GuardDecision {
  block: boolean;
  reasons: string[];
}

export function deterministicGuard(message: string, knownMerchants: Set<string>): GuardDecision {
  const words = message.toUpperCase().split(/[^A-Z]+/);
  const knownMerchant = words.some((word) => knownMerchants.has(word));
  const amount =
    CURRENCY_AMOUNT.test(message) || DECIMAL_AMOUNT.test(message) || (knownMerchant && BARE_NUMBER.test(message));
  const date = DATE.test(message);
  const statementStyle = STATEMENT_STYLE.test(message);
  const linesWithAmounts = message
    .split(/\r?\n/)
    .filter((line) => CURRENCY_AMOUNT.test(line) || DECIMAL_AMOUNT.test(line)).length;

  const reasons: string[] = [];
  if (linesWithAmounts >= 2) reasons.push('several statement-like lines');
  if (amount && date) reasons.push('amount with a date');
  if (amount && knownMerchant) reasons.push('amount with a merchant from your data');
  if (amount && statementStyle) reasons.push('amount with statement-style text');
  if (knownMerchant && date) reasons.push('merchant from your data with a date');

  return { block: reasons.length > 0, reasons };
}
