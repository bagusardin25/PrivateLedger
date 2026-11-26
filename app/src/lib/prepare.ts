// Labeling steps 1 to 4, without any model: normalize, merchant memory, rules, mixed-use
// list, then dedupe what is left so the on-device model sees each merchant once.
// Pure functions, so the G8 script can run them in Node.

import { normalizeMerchant } from './merchant.ts';
import { applyRules } from './rules.ts';
import type { Category, TxType } from './taxonomy.ts';

export interface RawRow {
  date: string;
  description: string;
  /** Negative is money out. */
  amount: number;
}

export type LabelSource = 'pending' | 'memory' | 'rule' | 'on-device' | 'cloud' | 'you';

export interface MemoryRule {
  merchantKey: string;
  type: TxType;
  category: Category;
}

export interface PreparedRow extends RawRow {
  merchantKey: string;
  cleanMerchant: string;
  type?: TxType;
  category?: Category;
  source: LabelSource;
  needsReview: boolean;
  reviewReason?: string;
  rule?: string;
}

export interface ModelMerchant {
  key: string;
  /** One raw description for this merchant, used as the model's example. */
  example: string;
  direction: 'in' | 'out';
  rowCount: number;
}

export function prepareRows(rows: RawRow[], memory: Map<string, MemoryRule>) {
  const prepared: PreparedRow[] = rows.map((row) => {
    const merchant = normalizeMerchant(row.description);
    const base = { ...row, merchantKey: merchant.key, cleanMerchant: merchant.name };

    const remembered = memory.get(merchant.key);
    if (remembered) {
      return { ...base, type: remembered.type, category: remembered.category, source: 'memory' as const, needsReview: false };
    }

    const ruled = applyRules(row.description, row.amount);
    if (ruled) {
      return {
        ...base,
        type: ruled.type,
        category: ruled.category,
        source: 'rule' as const,
        needsReview: ruled.needsReview,
        reviewReason: ruled.reason,
        rule: ruled.rule,
      };
    }

    return { ...base, source: 'pending' as const, needsReview: false };
  });

  const byKey = new Map<string, ModelMerchant>();
  for (const row of prepared) {
    if (row.source !== 'pending') continue;
    const existing = byKey.get(row.merchantKey);
    if (existing) existing.rowCount += 1;
    else byKey.set(row.merchantKey, { key: row.merchantKey, example: row.description, direction: row.amount >= 0 ? 'in' : 'out', rowCount: 1 });
  }

  return { rows: prepared, modelMerchants: [...byKey.values()] };
}
