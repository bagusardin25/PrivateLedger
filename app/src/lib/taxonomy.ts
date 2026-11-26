export const TYPES = ['business', 'personal', 'unsure'] as const;
export type TxType = (typeof TYPES)[number];

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

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

export function isTxType(value: unknown): value is TxType {
  return typeof value === 'string' && (TYPES as readonly string[]).includes(value);
}
