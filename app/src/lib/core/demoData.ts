// Synthetic demo data. Every merchant line, amount, and name here is invented;
// none of it comes from a real bank statement. The same 40 rows as the
// speed and accuracy test in spike/go-no-go, so results can be compared.

import type { Category } from './taxonomy.ts';

/** The demo statement is a US freelancer's, in US dollars. */
export const DEMO_CURRENCY = 'USD';

export const DEMO_PROFILE =
  'Freelance graphic designer working from home. Business tools: design software, stock assets, ' +
  'a coworking membership, a portfolio website, and email marketing. Clients pay through Stripe, PayPal, and Wise.';

export interface DemoRow {
  date: string;
  description: string;
  amount: number;
  /** Ground truth for tests only; never shown in the app. `ambiguous` rows could reasonably be either type. */
  expectedType: 'business' | 'personal' | 'ambiguous';
  expectedCategory: Category;
}

export const DEMO_ROWS: DemoRow[] = [
  { date: '2026-10-01', description: 'ADOBE *CREATIVE CLOUD 800-833-6687 CA', amount: -59.99, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-01', description: 'OAKWOOD PROPERTY MGMT RENT', amount: -1450.0, expectedType: 'personal', expectedCategory: 'Housing & Utilities' },
  { date: '2026-10-02', description: 'FIGMA MONTHLY SUBSCRIPTION', amount: -15.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-02', description: 'WHOLE FOODS MKT #10234', amount: -86.42, expectedType: 'personal', expectedCategory: 'Groceries' },
  { date: '2026-10-03', description: 'WEWORK MEMBERSHIP OCT', amount: -350.0, expectedType: 'business', expectedCategory: 'Office & Coworking' },
  { date: '2026-10-03', description: 'NETFLIX.COM', amount: -15.49, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-04', description: 'STRIPE TRANSFER ACME STUDIO INV-1042', amount: 2400.0, expectedType: 'business', expectedCategory: 'Income' },
  { date: '2026-10-05', description: 'SPOTIFY USA', amount: -11.99, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-05', description: 'AMAZON MKTP US*2K4LP0', amount: -45.67, expectedType: 'ambiguous', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-06', description: 'SHUTTERSTOCK *IMAGES', amount: -29.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-06', description: 'CVS/PHARMACY #08812', amount: -23.17, expectedType: 'personal', expectedCategory: 'Health' },
  { date: '2026-10-07', description: 'B&H PHOTO VIDEO WACOM TABLET', amount: -379.99, expectedType: 'business', expectedCategory: 'Equipment' },
  { date: '2026-10-08', description: 'PLANET FITNESS CLUB FEES', amount: -24.99, expectedType: 'personal', expectedCategory: 'Health' },
  { date: '2026-10-09', description: 'GOOGLE *WORKSPACE MAYA DESIGN', amount: -14.4, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-09', description: 'TRADER JOE S #552', amount: -54.3, expectedType: 'personal', expectedCategory: 'Groceries' },
  { date: '2026-10-10', description: 'UPWORK SERVICE FEE', amount: -48.0, expectedType: 'business', expectedCategory: 'Fees & Bank Charges' },
  { date: '2026-10-11', description: 'PG&E WEB ONLINE PAYMENT', amount: -98.12, expectedType: 'personal', expectedCategory: 'Housing & Utilities' },
  { date: '2026-10-12', description: 'DELTA AIR LINES 0062341', amount: -312.4, expectedType: 'ambiguous', expectedCategory: 'Travel' },
  { date: '2026-10-13', description: 'CHIPOTLE 2291', amount: -13.85, expectedType: 'personal', expectedCategory: 'Meals' },
  { date: '2026-10-14', description: 'MAILCHIMP *MONTHLY', amount: -20.0, expectedType: 'business', expectedCategory: 'Marketing' },
  { date: '2026-10-15', description: 'FACEBK *ADS 7XK2Q', amount: -75.0, expectedType: 'business', expectedCategory: 'Marketing' },
  { date: '2026-10-15', description: 'TARGET 00012345', amount: -67.9, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-16', description: 'QUICKBOOKS ONLINE', amount: -30.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-17', description: 'VENMO PAYMENT TO J. RIVERA', amount: -40.0, expectedType: 'personal', expectedCategory: 'Transfers' },
  { date: '2026-10-18', description: 'PAYPAL TRANSFER FROM BLUEPINE MEDIA', amount: 1250.0, expectedType: 'business', expectedCategory: 'Income' },
  { date: '2026-10-19', description: 'TRANSFER TO SAVINGS XXXX4471', amount: -500.0, expectedType: 'personal', expectedCategory: 'Transfers' },
  { date: '2026-10-19', description: 'STARBUCKS STORE 1123', amount: -6.45, expectedType: 'ambiguous', expectedCategory: 'Meals' },
  { date: '2026-10-20', description: 'SQUARESPACE ANNUAL PLAN', amount: -192.0, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-21', description: 'IRS USATAXPYMT EST TAX Q3', amount: -1100.0, expectedType: 'ambiguous', expectedCategory: 'Taxes' },
  { date: '2026-10-22', description: 'STEAMGAMES.COM', amount: -19.99, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-23', description: 'MONTHLY SERVICE FEE', amount: -12.0, expectedType: 'ambiguous', expectedCategory: 'Fees & Bank Charges' },
  { date: '2026-10-24', description: 'LEGALZOOM *LLC RENEWAL', amount: -99.0, expectedType: 'business', expectedCategory: 'Professional Services' },
  { date: '2026-10-25', description: 'SHELL OIL 57442', amount: -41.2, expectedType: 'ambiguous', expectedCategory: 'Travel' },
  { date: '2026-10-26', description: 'STAPLES 01234 PRINTER INK', amount: -64.18, expectedType: 'business', expectedCategory: 'Office & Coworking' },
  { date: '2026-10-26', description: 'APPLE.COM/BILL', amount: -2.99, expectedType: 'ambiguous', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-27', description: 'KAISER PERMANENTE COPAY', amount: -30.0, expectedType: 'personal', expectedCategory: 'Health' },
  { date: '2026-10-28', description: 'ZOOM.US 888-799-9666', amount: -15.99, expectedType: 'business', expectedCategory: 'Software & Subscriptions' },
  { date: '2026-10-29', description: 'AMC THEATRES 0441', amount: -28.5, expectedType: 'personal', expectedCategory: 'Shopping & Entertainment' },
  { date: '2026-10-30', description: 'WISE INC TRANSFER NORDLICHT GMBH', amount: 1800.0, expectedType: 'business', expectedCategory: 'Income' },
  { date: '2026-10-31', description: 'COSTCO WHSE #0482', amount: -132.1, expectedType: 'personal', expectedCategory: 'Groceries' },
];
