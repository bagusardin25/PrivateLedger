import { db } from '../data/db';
import { loadDemoData } from '../data/importer';
import { resetAdvisor } from '../ai/advisorStore';
import { resetExplanations } from '../ai/explainer';
import { labelingStore, recentArrivals, runOnDeviceLabeling } from '../ai/labelingRunner';
import { resetSummary } from '../ai/reporter';
import type { Category, TxType } from '../core/taxonomy';

/** Forgets in-memory results about the old transactions: chat, summary, explanations, sorting progress. */
export function resetSessionState(): void {
  resetAdvisor();
  resetSummary();
  resetExplanations();
  recentArrivals.clear();
  labelingStore.set({ status: 'idle', done: 0, total: 0, batch: 0, batches: 0, firstItemMs: undefined, message: undefined });
}

export type Route = 'welcome' | 'import' | 'transactions' | 'review' | 'summary' | 'advisor' | 'ledger';

export function navigate(route: Route): void {
  window.location.hash = `#/${route}`;
}

let setupRequested = false;

function scrollToSetup(): void {
  document.getElementById('setup')?.scrollIntoView({ block: 'start' });
}

/** Opens the Home screen at "Set up in a minute", where on-device AI is turned on. */
export function openSetup(): void {
  if (window.location.hash === '#/welcome' || window.location.hash === '') {
    scrollToSetup();
    return;
  }
  setupRequested = true;
  navigate('welcome');
}

/** Called by the app shell after a route change; true when it scrolled to the setup section. */
export function consumeSetupRequest(): boolean {
  if (!setupRequested) return false;
  setupRequested = false;
  scrollToSetup();
  return true;
}

/** "Try with demo data": load the synthetic statement, open the table, start labeling. */
export async function startDemo(): Promise<void> {
  await loadDemoData();
  navigate('transactions');
  void runOnDeviceLabeling();
}

/**
 * One click sets business or personal, clears the review flag, and saves
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

/**
 * "Label by hand": rows the on-device model could not reach go to the
 * review queue, so the user decides them one card at a time. Nothing is sent.
 */
export async function labelPendingByHand(): Promise<void> {
  const pending = await db.transactions.filter((t) => t.source === 'pending').toArray();
  await db.transactions.bulkUpdate(
    pending.map((t) => ({
      key: t.id,
      changes: {
        type: 'unsure' as const,
        category: t.category ?? 'Other',
        source: 'you' as const,
        needsReview: true,
        reviewReason: "Laptop AI wasn't available, so you decide",
      },
    })),
  );
  navigate('review');
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
