// Functions the cloud advisor can call. They run on this device against
// IndexedDB and return totals and counts only (data level L2). No merchant
// name, description, date of a single transaction, or account detail leaves.

import { Schema, type FunctionDeclaration } from 'firebase/ai';
import { db, type Transaction } from '../data/db';
import { getLedgerCurrency } from '../util/ledgerCurrency';

type Kind = 'business' | 'personal' | 'all';

const round = (n: number) => Math.round(n * 100) / 100;
const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
const settled = (t: Transaction) => t.type === 'business' || t.type === 'personal';

function monthsOf(rows: Transaction[]): string[] {
  return [...new Set(rows.map((t) => t.date.slice(0, 7)).filter(isMonth))].sort();
}

function resolvePeriod(rows: Transaction[], period: unknown): string {
  if (period === 'all') return 'all';
  if (isMonth(period)) return period;
  return monthsOf(rows).at(-1) ?? 'all';
}

function inPeriod(t: Transaction, period: string) {
  return period === 'all' || t.date.startsWith(period);
}

function spending(rows: Transaction[], kind: Kind) {
  return rows.filter((t) => settled(t) && t.amount < 0 && (kind === 'all' || t.type === kind));
}

function byCategory(rows: Transaction[], kind: Kind) {
  const map = new Map<string, { category: string; total: number; count: number }>();
  for (const t of spending(rows, kind)) {
    const key = t.category ?? 'Other';
    const entry = map.get(key) ?? { category: key, total: 0, count: 0 };
    entry.total += Math.abs(t.amount);
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].map((e) => ({ ...e, total: round(e.total) })).sort((a, b) => b.total - a.total);
}

function split(rows: Transaction[]) {
  const sum = (list: Transaction[]) => round(list.reduce((s, t) => s + Math.abs(t.amount), 0));
  return {
    business_spending: sum(spending(rows, 'business')),
    personal_spending: sum(spending(rows, 'personal')),
    business_income: sum(rows.filter((t) => t.type === 'business' && t.amount > 0)),
    not_sorted_count: rows.filter((t) => !settled(t)).length,
  };
}

type Args = Record<string, unknown>;

export const LOCAL_FUNCTIONS: Record<string, (rows: Transaction[], args: Args) => object> = {
  get_available_periods: (rows) => ({ months: monthsOf(rows), currency: getLedgerCurrency() }),

  get_business_personal_split: (rows, args) => {
    const period = resolvePeriod(rows, args.period);
    return { period, currency: getLedgerCurrency(), ...split(rows.filter((t) => inPeriod(t, period))) };
  },

  get_spending_by_category: (rows, args) => {
    const period = resolvePeriod(rows, args.period);
    const kind: Kind = args.type === 'personal' || args.type === 'all' ? args.type : 'business';
    return { period, type: kind, currency: getLedgerCurrency(), totals: byCategory(rows.filter((t) => inPeriod(t, period)), kind) };
  },

  get_monthly_totals: (rows, args) => {
    const months = monthsOf(rows).filter((m) => (!isMonth(args.from) || m >= args.from) && (!isMonth(args.to) || m <= args.to));
    return { currency: getLedgerCurrency(), months: months.map((month) => ({ month, ...split(rows.filter((t) => inPeriod(t, month))) })) };
  },

  compare_periods: (rows, args) => {
    const a = resolvePeriod(rows, args.a);
    const b = resolvePeriod(rows, args.b);
    const kind: Kind = args.type === 'personal' || args.type === 'all' ? args.type : 'business';
    const left = new Map(byCategory(rows.filter((t) => inPeriod(t, a)), kind).map((r) => [r.category, r.total]));
    const right = new Map(byCategory(rows.filter((t) => inPeriod(t, b)), kind).map((r) => [r.category, r.total]));
    const categories = [...new Set([...left.keys(), ...right.keys()])];
    return {
      type: kind,
      currency: getLedgerCurrency(),
      period_a: a,
      period_b: b,
      categories: categories
        .map((category) => ({ category, total_a: left.get(category) ?? 0, total_b: right.get(category) ?? 0, change: round((right.get(category) ?? 0) - (left.get(category) ?? 0)) }))
        .sort((x, y) => Math.abs(y.change) - Math.abs(x.change)),
    };
  },

  get_review_status: (rows) => ({
    total: rows.length,
    needs_review: rows.filter((t) => t.needsReview).length,
    waiting_for_on_device_ai: rows.filter((t) => t.source === 'pending').length,
  }),
};

const period = Schema.string({ description: "Month as YYYY-MM, or 'all'. Defaults to the latest month with data." });
const kind = Schema.enumString({ enum: ['business', 'personal', 'all'], description: 'Which spending to include. Defaults to business.' });

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  { name: 'get_available_periods', description: 'Lists the months that have transactions. Runs on the user device. Call it when you do not know which month the user means.' },
  {
    name: 'get_business_personal_split',
    description: 'Total business spending, personal spending, business income, and the count of unsorted transactions for one month. Runs on the user device; returns totals only.',
    parameters: Schema.object({ properties: { period }, optionalProperties: ['period'] }),
  },
  {
    name: 'get_spending_by_category',
    description: 'Spending per category for one month, with transaction counts. Runs on the user device; returns totals only.',
    parameters: Schema.object({ properties: { period, type: kind }, optionalProperties: ['period', 'type'] }),
  },
  {
    name: 'get_monthly_totals',
    description: 'Business spending, personal spending, and business income per month in a range. Runs on the user device; returns totals only.',
    parameters: Schema.object({
      properties: { from: Schema.string({ description: 'First month, YYYY-MM.' }), to: Schema.string({ description: 'Last month, YYYY-MM.' }) },
      optionalProperties: ['from', 'to'],
    }),
  },
  {
    name: 'compare_periods',
    description: 'Per-category change in spending between two months. Runs on the user device; returns totals only.',
    parameters: Schema.object({
      properties: { a: Schema.string({ description: 'Earlier month, YYYY-MM.' }), b: Schema.string({ description: 'Later month, YYYY-MM.' }), type: kind },
      optionalProperties: ['type'],
    }),
  },
  { name: 'get_review_status', description: 'How many transactions still need the user decision or are waiting for on-device AI. Runs on the user device.' },
];

export async function runLocalFunction(name: string, args: Args): Promise<object> {
  const fn = LOCAL_FUNCTIONS[name];
  if (!fn) return { error: `Unknown function ${name}` };
  return fn(await db.transactions.toArray(), args ?? {});
}

const LABELS: Record<string, string> = {
  get_available_periods: 'Months with data',
  get_business_personal_split: 'Business vs personal totals',
  get_spending_by_category: 'Spending by category',
  get_monthly_totals: 'Totals per month',
  compare_periods: 'Change between months',
  get_review_status: 'Review status',
};

/** "Spending by category · 2026-10 · business" for the chat UI. */
export function describeCall(name: string, args: Args): string {
  const parts = [LABELS[name] ?? name];
  for (const key of ['period', 'a', 'b', 'from', 'to', 'type']) {
    if (typeof args?.[key] === 'string') parts.push(String(args[key]));
  }
  return parts.join(' · ');
}
