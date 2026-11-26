import { db } from './db';
import { loadDemoData } from './importer';
import { runOnDeviceLabeling } from './labelingRunner';
import type { Category, TxType } from './taxonomy';

export type Route = 'welcome' | 'import' | 'transactions' | 'review' | 'summary';

export function navigate(route: Route): void {
  window.location.hash = `#/${route}`;
}

/** "Try with demo data": load the synthetic statement, open the table, start labeling. */
export async function startDemo(): Promise<void> {
  await loadDemoData();
  navigate('transactions');
  void runOnDeviceLabeling();
}

/**
 * F4: one click sets business or personal, clears the review flag, and saves
 * the choice as merchant memory so the same merchant never needs the model again.
 */
export async function setTypeByUser(transactionId: string, type: Exclude<TxType, 'unsure'>): Promise<void> {
  const tx = await db.transactions.get(transactionId);
  if (!tx) return;
  const category = tx.category ?? 'Other';
  await db.transaction('rw', db.transactions, db.merchantRules, async () => {
    await db.merchantRules.put({ merchantKey: tx.merchantKey, type, category, updatedAt: Date.now() });
    const sameMerchant = await db.transactions.where('merchantKey').equals(tx.merchantKey).toArray();
    await db.transactions.bulkUpdate(
      sameMerchant
        .filter((t) => t.id === tx.id || t.source !== 'you')
        .map((t) => ({
          key: t.id,
          changes: {
            type,
            category: t.category ?? category,
            source: t.id === tx.id ? ('you' as const) : ('memory' as const),
            needsReview: false,
            reviewReason: undefined,
            reviewed: t.id === tx.id ? true : t.reviewed,
          },
        })),
    );
  });
}

/** Allows correcting a row's category and updating merchant memory when type is settled. */
export async function setCategoryByUser(transactionId: string, category: Category): Promise<void> {
  const tx = await db.transactions.get(transactionId);
  if (!tx) return;
  if (tx.type !== 'business' && tx.type !== 'personal') {
    await db.transactions.update(tx.id, { category });
    return;
  }
  const settledType = tx.type;
  await db.transaction('rw', db.transactions, db.merchantRules, async () => {
    await db.merchantRules.put({ merchantKey: tx.merchantKey, type: settledType, category, updatedAt: Date.now() });
    const sameMerchant = await db.transactions.where('merchantKey').equals(tx.merchantKey).toArray();
    await db.transactions.bulkUpdate(
      sameMerchant
        .filter((t) => t.id === tx.id || t.source !== 'you')
        .map((t) => ({
          key: t.id,
          changes: {
            type: t.type === 'business' || t.type === 'personal' ? t.type : settledType,
            category,
            source: t.id === tx.id ? ('you' as const) : ('memory' as const),
            reviewed: t.id === tx.id ? true : t.reviewed,
          },
        })),
    );
  });
}
