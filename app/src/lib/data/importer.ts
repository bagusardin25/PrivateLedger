import { db, type Transaction } from './db';
import { DEMO_CURRENCY, DEMO_PROFILE, DEMO_ROWS } from '../core/demoData';
import { prepareRows, type MemoryRule, type RawRow } from '../core/prepare';
import { currencyName } from '../util/currency';
import { getLedgerCurrency, setLedgerCurrency } from '../util/ledgerCurrency';

/**
 * The ledger's currency when it already holds transactions in a different one
 * than `currency`; undefined when adding `currency` is safe. Amounts in two
 * currencies are never added together, so a different one means starting over.
 */
export async function currencyConflict(currency: string, options: { ignoreDemo?: boolean } = {}): Promise<string | undefined> {
  const existing = options.ignoreDemo ? await db.transactions.filter((t) => !t.isDemo).count() : await db.transactions.count();
  const current = getLedgerCurrency();
  return existing > 0 && current !== currency ? current : undefined;
}

export async function importRows(rows: RawRow[], meta: { fileName: string; isDemo: boolean; currency: string }): Promise<string> {
  const conflict = await currencyConflict(meta.currency);
  if (conflict) {
    throw new Error(`Your transactions are in ${currencyName(conflict)}. Start over before adding ${currencyName(meta.currency)} transactions.`);
  }
  setLedgerCurrency(meta.currency);
  const importId = crypto.randomUUID();
  const memory = new Map<string, MemoryRule>((await db.merchantRules.toArray()).map((r) => [r.merchantKey, r]));
  const { rows: prepared } = prepareRows(rows, memory);
  const transactions: Transaction[] = prepared.map((p, i) => ({
    id: `${importId}-${i}`,
    importId,
    row: i,
    date: p.date,
    rawDescription: p.description,
    amount: p.amount,
    merchantKey: p.merchantKey,
    cleanMerchant: p.cleanMerchant,
    type: p.type,
    category: p.category,
    source: p.source,
    needsReview: p.needsReview,
    reviewReason: p.reviewReason,
    reviewed: false,
    isDemo: meta.isDemo,
  }));
  await db.transaction('rw', db.transactions, db.imports, async () => {
    await db.transactions.bulkAdd(transactions);
    await db.imports.add({
      id: importId,
      fileName: meta.fileName,
      rowCount: transactions.length,
      importedAt: Date.now(),
      isDemo: meta.isDemo,
      currency: meta.currency,
    });
  });
  return importId;
}

/** Replaces any earlier demo rows, so the demo can be restarted cleanly. */
export async function loadDemoData(): Promise<string> {
  const conflict = await currencyConflict(DEMO_CURRENCY, { ignoreDemo: true });
  if (conflict) {
    throw new Error(`Your own transactions are in ${currencyName(conflict)} and the demo is in US dollars. Start over to try the demo.`);
  }
  await db.transaction('rw', db.transactions, db.imports, db.profile, async () => {
    const oldDemo = await db.imports.filter((i) => i.isDemo).toArray();
    for (const record of oldDemo) {
      await db.transactions.where('importId').equals(record.id).delete();
      await db.imports.delete(record.id);
    }
    const profile = await db.profile.get('me');
    if (!profile?.businessDescription) await db.profile.put({ id: 'me', businessDescription: DEMO_PROFILE });
  });
  return importRows(
    DEMO_ROWS.map(({ date, description, amount }) => ({ date, description, amount })),
    { fileName: 'demo-statement.csv', isDemo: true, currency: DEMO_CURRENCY },
  );
}
