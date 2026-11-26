// Deterministic labeling (steps 3 and 4). The test in spike/go-no-go showed the
// on-device model never answers "unsure" (0 of 7 ambiguous rows) and labeled
// transfers and a warehouse club as business with high confidence. These rules
// run before the model, so those cases never depend on the model's judgment.

import type { Category, TxType } from './taxonomy.ts';

export interface RuleLabel {
  type: TxType;
  category: Category;
  needsReview: boolean;
  reason: string;
  rule: string;
}

interface Rule {
  id: string;
  test: (description: string, amount: number) => boolean;
  label: Omit<RuleLabel, 'rule'>;
}

const has = (pattern: RegExp) => (description: string) => pattern.test(description);

/** Step 3: patterns that settle type and category without a model. */
const RULES: Rule[] = [
  {
    id: 'own-account-transfer',
    test: has(/\b(TRANSFER|XFER)\b.*\b(TO|FROM)\b.*\b(SAVINGS|CHECKING|SAV|CHK)\b|\bINTERNAL TRANSFER\b/),
    label: { type: 'personal', category: 'Transfers', needsReview: false, reason: 'Transfer between your own accounts' },
  },
  {
    id: 'p2p-to-person',
    test: (d, amount) => amount < 0 && /^(VENMO|ZELLE|CASH APP|CASHAPP|SQC\*CASH)\b/.test(d),
    label: { type: 'personal', category: 'Transfers', needsReview: false, reason: 'Payment app transfer to a person' },
  },
  {
    id: 'payroll',
    test: (d, amount) => amount > 0 && /\b(PAYROLL|SALARY|DIR(ECT)? ?DEP)\b/.test(d),
    label: { type: 'personal', category: 'Income', needsReview: false, reason: 'Salary from an employer' },
  },
  {
    id: 'client-payout',
    test: (d, amount) =>
      amount > 0 && /\b(STRIPE|PAYPAL|WISE|PAYONEER|UPWORK|FIVERR|TOPTAL)\b/.test(d) && /\b(TRANSFER|PAYOUT|PAYMENT|DEPOSIT)\b/.test(d),
    label: { type: 'business', category: 'Income', needsReview: false, reason: 'Client payment through a payment platform' },
  },
  {
    id: 'bank-fee',
    test: has(/\b(MONTHLY SERVICE FEE|MAINTENANCE FEE|OVERDRAFT|NSF FEE|ATM FEE|WIRE FEE|FOREIGN TRANSACTION FEE)\b/),
    label: {
      type: 'unsure',
      category: 'Fees & Bank Charges',
      needsReview: true,
      reason: 'Bank fee on a shared account: decide which side pays it',
    },
  },
];

/**
 * Step 4: merchants that can reasonably be business or personal. They always go
 * to the review queue, whatever a model would say.
 */
const MIXED_USE: { id: string; pattern: RegExp; category: Category; reason: string }[] = [
  { id: 'marketplace', pattern: /\b(AMAZON|AMZN|EBAY|WALMART|ETSY)\b/, category: 'Shopping & Entertainment', reason: 'Marketplace: could be supplies or personal shopping' },
  { id: 'airline', pattern: /\b(DELTA AIR|UNITED AIR|AMERICAN AIR|SOUTHWEST|JETBLUE|ALASKA AIR|SPIRIT AIR|FRONTIER AIR)/, category: 'Travel', reason: 'Flight: could be a client trip or a holiday' },
  { id: 'lodging', pattern: /\b(AIRBNB|MARRIOTT|HILTON|HYATT|EXPEDIA|BOOKING\.COM)\b/, category: 'Travel', reason: 'Lodging: could be a work trip or personal travel' },
  { id: 'rideshare', pattern: /\b(UBER|LYFT)\b/, category: 'Travel', reason: 'Ride: could be a client meeting or personal' },
  { id: 'coffee', pattern: /\b(STARBUCKS|DUNKIN|PEET'?S|BLUE BOTTLE)\b/, category: 'Meals', reason: 'Coffee shop: could be a client meeting or personal' },
  { id: 'fuel', pattern: /\b(SHELL|CHEVRON|EXXON|MOBIL|ARCO|SUNOCO|TEXACO|BP)\b/, category: 'Travel', reason: 'Fuel: business share depends on how the car was used' },
  { id: 'app-store', pattern: /\b(APPLE\.COM\/BILL|APPLE COM BILL|GOOGLE \*?PLAY|GOOGLE PLAY)\b/, category: 'Software & Subscriptions', reason: 'App store: could be work software or personal apps' },
  { id: 'warehouse-club', pattern: /\b(COSTCO|SAMS CLUB|SAM'S CLUB|BJ'?S WHOLESALE)\b/, category: 'Groceries', reason: 'Warehouse club: could be office supplies or groceries' },
  { id: 'phone-internet', pattern: /\b(VERIZON|AT&T|T-MOBILE|TMOBILE|COMCAST|XFINITY|SPECTRUM)\b/, category: 'Housing & Utilities', reason: 'Phone or internet: often used for both' },
  { id: 'tax-payment', pattern: /\b(IRS|USATAXPYMT|FRANCHISE TAX|DEPT OF REVENUE)\b/, category: 'Taxes', reason: 'Tax payment: estimated business tax or personal tax?' },
];

export function applyRules(rawDescription: string, amount: number): RuleLabel | undefined {
  const d = rawDescription.toUpperCase();
  for (const rule of RULES) {
    if (rule.test(d, amount)) return { ...rule.label, rule: rule.id };
  }
  for (const mixed of MIXED_USE) {
    if (mixed.pattern.test(d)) {
      return { type: 'unsure', category: mixed.category, needsReview: true, reason: mixed.reason, rule: `mixed-use:${mixed.id}` };
    }
  }
  return undefined;
}
