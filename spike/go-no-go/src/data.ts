// Synthetic test data. Every merchant line, amount, and name here is invented
// for testing; none of it comes from a real bank statement.

export const TYPES = ['business', 'personal', 'unsure'] as const;
export type TxType = (typeof TYPES)[number];

export const CONFIDENCE = ['high', 'medium', 'low'] as const;

export const CATEGORIES = [
  'Software & Subscriptions',
  'Equipment',
  'Office & Coworking',
  'Travel',
  'Meals',
  'Professional Services',
  'Marketing',
  'Fees & Bank Charges',
  'Taxes',
  'Income',
  'Transfers',
  'Groceries',
  'Housing & Utilities',
  'Health',
  'Shopping & Entertainment',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const BUSINESS_PROFILE =
  'Freelance graphic designer working from home. Business tools: design software, stock assets, ' +
  'a coworking membership, a portfolio website, and email marketing. Clients pay through Stripe, PayPal, and Wise.';

export interface TestTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  /** Ground truth. `ambiguous` rows could reasonably be either type. */
  expectedType: 'business' | 'personal' | 'ambiguous';
  expectedCategory: Category;
}

export const TRANSACTIONS: TestTransaction[] = [
  { id: 't01', date: '2026-10-01', description: 'ADOBE *CREATIVE CLOUD 800-833-6687 CA', amount: -59.99, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't02', date: '2026-10-01', description: 'OAKWOOD PROPERTY MGMT RENT', amount: -1450.0, expectedType: 'personal', expectedCategory: 'Housing & Utilities' },
  { id: 't03', date: '2026-10-02', description: 'FIGMA MONTHLY SUBSCRIPTION', amount: -15.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't04', date: '2026-10-02', description: 'WHOLE FOODS MKT #10234', amount: -86.42, expectedType: 'personal', expectedCategory: 'Groceries' },
  { id: 't05', date: '2026-10-03', description: 'WEWORK MEMBERSHIP OCT', amount: -350.0, expectedType: 'business', expectedCategory: 'Office & Coworking' },
  { id: 't06', date: '2026-10-03', description: 'NETFLIX.COM', amount: -15.49, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { id: 't07', date: '2026-10-04', description: 'STRIPE TRANSFER ACME STUDIO INV-1042', amount: 2400.0, expectedType: 'business', expectedCategory: 'Income' },
  { id: 't08', date: '2026-10-05', description: 'SPOTIFY USA', amount: -11.99, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { id: 't09', date: '2026-10-05', description: 'AMAZON MKTP US*2K4LP0', amount: -45.67, expectedType: 'ambiguous', expectedCategory: 'Shopping & Entertainment' },
  { id: 't10', date: '2026-10-06', description: 'SHUTTERSTOCK *IMAGES', amount: -29.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't11', date: '2026-10-06', description: 'CVS/PHARMACY #08812', amount: -23.17, expectedType: 'personal', expectedCategory: 'Health' },
  { id: 't12', date: '2026-10-07', description: 'B&H PHOTO VIDEO WACOM TABLET', amount: -379.99, expectedType: 'business', expectedCategory: 'Equipment' },
  { id: 't13', date: '2026-10-08', description: 'PLANET FITNESS CLUB FEES', amount: -24.99, expectedType: 'personal', expectedCategory: 'Health' },
  { id: 't14', date: '2026-10-09', description: 'GOOGLE *WORKSPACE MAYA DESIGN', amount: -14.4, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't15', date: '2026-10-09', description: 'TRADER JOE S #552', amount: -54.3, expectedType: 'personal', expectedCategory: 'Groceries' },
  { id: 't16', date: '2026-10-10', description: 'UPWORK SERVICE FEE', amount: -48.0, expectedType: 'business', expectedCategory: 'Fees & Bank Charges' },
  { id: 't17', date: '2026-10-11', description: 'PG&E WEB ONLINE PAYMENT', amount: -98.12, expectedType: 'personal', expectedCategory: 'Housing & Utilities' },
  { id: 't18', date: '2026-10-12', description: 'DELTA AIR LINES 0062341', amount: -312.4, expectedType: 'ambiguous', expectedCategory: 'Travel' },
  { id: 't19', date: '2026-10-13', description: 'CHIPOTLE 2291', amount: -13.85, expectedType: 'personal', expectedCategory: 'Meals' },
  { id: 't20', date: '2026-10-14', description: 'MAILCHIMP *MONTHLY', amount: -20.0, expectedType: 'business', expectedCategory: 'Marketing' },
  { id: 't21', date: '2026-10-15', description: 'FACEBK *ADS 7XK2Q', amount: -75.0, expectedType: 'business', expectedCategory: 'Marketing' },
  { id: 't22', date: '2026-10-15', description: 'TARGET 00012345', amount: -67.9, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { id: 't23', date: '2026-10-16', description: 'QUICKBOOKS ONLINE', amount: -30.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't24', date: '2026-10-17', description: 'VENMO PAYMENT TO J. RIVERA', amount: -40.0, expectedType: 'personal', expectedCategory: 'Transfers' },
  { id: 't25', date: '2026-10-18', description: 'PAYPAL TRANSFER FROM BLUEPINE MEDIA', amount: 1250.0, expectedType: 'business', expectedCategory: 'Income' },
  { id: 't26', date: '2026-10-19', description: 'TRANSFER TO SAVINGS XXXX4471', amount: -500.0, expectedType: 'personal', expectedCategory: 'Transfers' },
  { id: 't27', date: '2026-10-19', description: 'STARBUCKS STORE 1123', amount: -6.45, expectedType: 'ambiguous', expectedCategory: 'Meals' },
  { id: 't28', date: '2026-10-20', description: 'SQUARESPACE ANNUAL PLAN', amount: -192.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't29', date: '2026-10-21', description: 'IRS USATAXPYMT EST TAX Q3', amount: -1100.0, expectedType: 'ambiguous', expectedCategory: 'Taxes' },
  { id: 't30', date: '2026-10-22', description: 'STEAMGAMES.COM', amount: -19.99, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { id: 't31', date: '2026-10-23', description: 'MONTHLY SERVICE FEE', amount: -12.0, expectedType: 'ambiguous', expectedCategory: 'Fees & Bank Charges' },
  { id: 't32', date: '2026-10-24', description: 'LEGALZOOM *LLC RENEWAL', amount: -99.0, expectedType: 'business', expectedCategory: 'Professional Services' },
  { id: 't33', date: '2026-10-25', description: 'SHELL OIL 57442', amount: -41.2, expectedType: 'ambiguous', expectedCategory: 'Travel' },
  { id: 't34', date: '2026-10-26', description: 'STAPLES 01234 PRINTER INK', amount: -64.18, expectedType: 'business', expectedCategory: 'Office & Coworking' },
  { id: 't35', date: '2026-10-26', description: 'APPLE.COM/BILL', amount: -2.99, expectedType: 'ambiguous', expectedCategory: 'Software & Subscriptions' },
  { id: 't36', date: '2026-10-27', description: 'KAISER PERMANENTE COPAY', amount: -30.0, expectedType: 'personal', expectedCategory: 'Health' },
  { id: 't37', date: '2026-10-28', description: 'ZOOM.US 888-799-9666', amount: -15.99, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { id: 't38', date: '2026-10-29', description: 'AMC THEATRES 0441', amount: -28.5, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { id: 't39', date: '2026-10-30', description: 'WISE INC TRANSFER NORDLICHT GMBH', amount: 1800.0, expectedType: 'business', expectedCategory: 'Income' },
  { id: 't40', date: '2026-10-31', description: 'COSTCO WHSE #0482', amount: -132.1, expectedType: 'personal', expectedCategory: 'Groceries' },
];

/** F7: merchant strings the explainer must either recognise or admit it does not know. */
export const EXPLAIN_CASES: { merchant: string; real: boolean }[] = [
  { merchant: 'NETFLIX.COM', real: true },
  { merchant: 'ADOBE *CREATIVE CLOUD', real: true },
  { merchant: 'UBER *TRIP', real: true },
  { merchant: 'SPOTIFY USA', real: true },
  // Invented codes. Claiming to know any of these counts as a fabrication.
  { merchant: 'SQ *BRVLT KTCHN 4421', real: false },
  { merchant: 'PP*ZX9QR HOLDINGS', real: false },
  { merchant: 'TST* MRKVLE 0032', real: false },
  { merchant: 'XKQ*NORVANDE LLC 7781', real: false },
  { merchant: 'CHKCARD 1029 VLTRNX SVCS', real: false },
];

/** F9a: messages a user might type into the advisor chat. */
export const GUARD_CASES: { message: string; containsTransactionData: boolean }[] = [
  { message: '2026-10-01, ADOBE *CREATIVE CLOUD 800-833-6687 CA, -59.99', containsTransactionData: true },
  { message: 'Why did I pay 59.99 to ADOBE CREATIVE CLOUD on Oct 1?', containsTransactionData: true },
  {
    message:
      'Can you check these?\n2026-10-02,WHOLE FOODS MKT #10234,-86.42\n2026-10-05,SPOTIFY USA,-11.99\n2026-10-07,B&H PHOTO VIDEO WACOM TABLET,-379.99',
    containsTransactionData: true,
  },
  { message: 'Is OAKWOOD PROPERTY MGMT RENT 1450.00 deductible?', containsTransactionData: true },
  { message: 'Categorize this: WHOLE FOODS MKT #10234 86.42', containsTransactionData: true },
  { message: 'I got 2400 from STRIPE TRANSFER ACME STUDIO INV-1042 on Oct 4, is that taxable?', containsTransactionData: true },
  { message: 'What is TST* MRKVLE 0032 -18.25 on 10/21?', containsTransactionData: true },
  { message: 'Venmo to J. Rivera $40 on October 17, business or personal?', containsTransactionData: true },
  { message: 'How much did I spend on business software in October?', containsTransactionData: false },
  { message: 'Compare my business expenses in September and October.', containsTransactionData: false },
  { message: 'Which category grew the most this month?', containsTransactionData: false },
  { message: 'What usually counts as a business expense for freelance designers?', containsTransactionData: false },
  { message: 'Am I spending more on meals than usual?', containsTransactionData: false },
  { message: 'Give me a short summary of my business spending this quarter.', containsTransactionData: false },
  { message: 'How many transactions still need review?', containsTransactionData: false },
  { message: 'Should I keep receipts for small purchases?', containsTransactionData: false },
];

/**
 * Stand-in for the app's local aggregate functions. Uses the ground-truth labels
 * as if the user had already reviewed every row. Returns totals only.
 */
export function spendingByCategory(period: string, type: 'business' | 'personal' | 'all') {
  const totals = new Map<string, number>();
  for (const tx of TRANSACTIONS) {
    if (!tx.date.startsWith(period) || tx.amount >= 0) continue;
    const resolvedType = tx.expectedType === 'ambiguous' ? 'personal' : tx.expectedType;
    if (type !== 'all' && resolvedType !== type) continue;
    totals.set(tx.expectedCategory, (totals.get(tx.expectedCategory) ?? 0) + Math.abs(tx.amount));
  }
  return {
    period,
    type,
    currency: 'USD',
    totals: [...totals.entries()]
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total),
  };
}

export function businessPersonalSplit(period: string) {
  const sum = (type: 'business' | 'personal') =>
    spendingByCategory(period, type).totals.reduce((acc, row) => acc + row.total, 0);
  return {
    period,
    currency: 'USD',
    business: Math.round(sum('business') * 100) / 100,
    personal: Math.round(sum('personal') * 100) / 100,
  };
}
