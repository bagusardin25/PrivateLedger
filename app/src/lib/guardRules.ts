// Layer 1 of the outgoing-message guard: deterministic checks that run without
// any model, before a chat message can leave the device.
//
// How these rules were tested, kept honest (see scripts/g9.ts):
// - v1 came unchanged from the go/no-go spike and was then tested with messages
//   written after it was locked (set A): 8 of 8 caught, no false block.
// - v2 adds one rule after an audit found a gap: a message that only NAMES a
//   merchant or payee from the user's data ("What did I pay Adobe?") was sent.
//   Set B was written before that rule, so it proves the gap is closed, not
//   that the rule generalizes. The README lists what the guard still misses.

/**
 * Words that appear in bank descriptions but do not identify a merchant. They
 * never count as "a merchant from your data", so ordinary questions pass.
 */
const GENERIC_WORDS = new Set(
  `ANNUAL APPLE CLOUD COPAY CREATIVE DELTA DESIGN FITNESS FOODS IMAGES LINES MEDIA MEMBERSHIP MONTHLY ONLINE PAYMENT
  PHARMACY PHOTO PLANET PRINTER PROPERTY RENEWAL SAVINGS SERVICE SHELL STORE STUDIO SUBSCRIPTION TABLET TARGET THEATRES
  TRADER TRANSFER VIDEO WHOLE WORKSPACE
  ACCOUNT AUTOPAY BALANCE BANK BANKING BILL BILLING CARD CASH CHARGE CHARGES CHECK CHECKING CREDIT DEBIT DEPOSIT DIRECT
  ELECTRONIC FEES INTEREST INVOICE PAYMENTS PAYROLL PAYOUT PURCHASE RECURRING REFUND RETURN REWARD REWARDS SALARY STATEMENT
  WITHDRAWAL WIRE MOBILE
  SOFTWARE SUBSCRIPTIONS EQUIPMENT OFFICE COWORKING TRAVEL MEALS PROFESSIONAL SERVICES MARKETING TAXES INCOME TRANSFERS
  GROCERIES GROCERY HOUSING UTILITIES HEALTH SHOPPING ENTERTAINMENT OTHER BUSINESS PERSONAL
  COFFEE RESTAURANT CAFE PIZZA BURGER GRILL KITCHEN MARKET SUPERMARKET FOOD HOTEL FLIGHT AIRLINE AIRLINES PARKING FUEL
  INSURANCE INTERNET PHONE WIRELESS ELECTRIC ENERGY POWER WATER RENT RENTAL MEDICAL DENTAL CLINIC HOSPITAL SUPPLY SUPPLIES
  HARDWARE BOOKS MUSIC GAMES MOVIES THEATER CLUB PLAN PREMIUM BASIC STANDARD LICENSE DOMAIN HOSTING DIGITAL GLOBAL
  INTERNATIONAL NATIONAL AMERICAN UNITED FIRST GROUP COMPANY CENTER CENTRE STATION EXPRESS DELIVERY SHIPPING POSTAGE
  PRINTING CONSULTING FREELANCE CLIENT CLIENTS PROJECT WEBSITE PORTFOLIO ADVERTISING MONTH MONTHS YEARLY WEEKLY DAILY
  QUARTER TOTAL TOTALS AMOUNT SPENDING SPEND SPENT EXPENSE EXPENSES COSTS DONATION CHARITY EDUCATION TUITION COURSE
  TRAINING CHILDCARE LOAN MORTGAGE AUTO REPAIR MAINTENANCE
  JANUARY FEBRUARY MARCH APRIL AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER`.split(/\s+/),
);

const CURRENCY_AMOUNT = /[$€£]\s?\d[\d,]*(?:\.\d{1,2})?/;
const DECIMAL_AMOUNT = /(?<![\d.])[-+]?\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)|(?<![\d.])[-+]?\d+\.\d{2}(?!\d)/;
const BARE_NUMBER = /\b\d{2,}\b/;
const DATE =
  /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;
/** Two or more consecutive upper-case tokens, the way statement lines are written. */
const STATEMENT_STYLE = /\b[A-Z][A-Z0-9&*.'\/-]{2,}(?:\s+[A-Z0-9&*.'\/#-]{2,})+/;

/** Distinctive single words from the user's bank descriptions, e.g. ADOBE, RIVERA, COSTCO. */
export function merchantTokens(descriptions: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const description of descriptions) {
    for (const word of description.toUpperCase().split(/[^A-Z]+/)) {
      if (word.length >= 5 && !GENERIC_WORDS.has(word)) tokens.add(word);
    }
  }
  return tokens;
}

/**
 * Normalized merchant keys, matched as whole phrases. This catches merchants
 * made of ordinary words ("WHOLE FOODS", "SHELL OIL") and short names ("ZOOM")
 * that the single-word tokens deliberately leave out.
 */
export function merchantPhrases(merchantKeys: string[]): string[] {
  const phrases = new Set<string>();
  for (const key of merchantKeys) {
    const phrase = key.toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').trim();
    const words = phrase.split(' ').filter(Boolean);
    if (words.length >= 2) phrases.add(words.join(' '));
    else if (words.length === 1 && words[0].length >= 4 && !GENERIC_WORDS.has(words[0])) phrases.add(words[0]);
  }
  return [...phrases];
}

export interface GuardDecision {
  block: boolean;
  reasons: string[];
}

const titleCase = (text: string) => text.replace(/[A-Z]+/g, (word) => word.charAt(0) + word.slice(1).toLowerCase());

export function deterministicGuard(message: string, knownMerchants: Set<string>, knownPhrases: string[] = []): GuardDecision {
  const words = message.toUpperCase().split(/[^A-Z]+/);
  const flat = ` ${message.toUpperCase().replace(/[^A-Z0-9&]+/g, ' ').trim()} `;
  const namedMerchant = words.find((word) => knownMerchants.has(word)) ?? knownPhrases.find((phrase) => flat.includes(` ${phrase} `));
  const knownMerchant = namedMerchant !== undefined;
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
  // v2: a merchant or payee name is itself data from the statement.
  if (namedMerchant && !reasons.some((reason) => reason.includes('merchant'))) {
    reasons.push(`names "${titleCase(namedMerchant)}", a merchant or payee from your data`);
  }

  return { block: reasons.length > 0, reasons };
}
