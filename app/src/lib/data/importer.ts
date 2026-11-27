import { db, type Transaction } from './db';
import { DEMO_PROFILE, DEMO_ROWS } from '../core/demoData';
import { prepareRows, type MemoryRule, type RawRow } from '../core/prepare';

export async function importRows(rows: RawRow[], meta: { fileName: string; isDemo: boolean }): Promise<string> {
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
    await db.imports.add({ id: importId, fileName: meta.fileName, rowCount: transactions.length, importedAt: Date.now(), isDemo: meta.isDemo });
  });
  return importId;
}

/** Replaces any earlier demo rows, so the demo can be restarted cleanly. */
export async function loadDemoData(): Promise<string> {
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
    { fileName: 'demo-statement.csv', isDemo: true },
  );
}
