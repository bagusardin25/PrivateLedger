// Local storage (IndexedDB through Dexie). Everything here stays in the browser.
// Firestore never holds financial data (PRD section 5).

import Dexie, { type EntityTable } from 'dexie';
import type { LabelSource } from './prepare';
import type { Category, TxType } from './taxonomy';

export interface Transaction {
  id: string;
  importId: string;
  /** Position in the original file, for stable ordering. */
  row: number;
  date: string;
  rawDescription: string;
  /** Negative is money out. */
  amount: number;
  merchantKey: string;
  cleanMerchant: string;
  type?: TxType;
  category?: Category;
  source: LabelSource;
  needsReview: boolean;
  reviewReason?: string;
  reviewed: boolean;
  isDemo: boolean;
}

export interface MerchantRule {
  merchantKey: string;
  type: TxType;
  category: Category;
  updatedAt: number;
}

export type LedgerSource = 'on_device' | 'in_cloud' | 'blocked' | 'refused';

export interface LedgerEntry {
  id?: number;
  timestamp: number;
  feature: string;
  mode: string;
  inferenceSource: LedgerSource;
  model?: string;
  /** Exact payload for cloud calls; a short description for on-device calls. */
  payloadPreview: string;
  bytes: number;
  /** Raw transaction rows that left the device in this call. */
  rawRowCount: number;
  merchantNameCount: number;
  consent: boolean;
  isDemo: boolean;
  durationMs?: number;
  error?: string;
}

export interface Profile {
  id: 'me';
  businessDescription: string;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  rowCount: number;
  importedAt: number;
  isDemo: boolean;
}

class LedgerDb extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>;
  merchantRules!: EntityTable<MerchantRule, 'merchantKey'>;
  ledgerEntries!: EntityTable<LedgerEntry, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;

  constructor() {
    super('private-ledger');
    this.version(1).stores({
      transactions: 'id, importId, merchantKey, row',
      merchantRules: 'merchantKey',
      ledgerEntries: '++id, timestamp',
      profile: 'id',
      imports: 'id, importedAt',
    });
  }
}

export const db = new LedgerDb();

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.transactions, db.merchantRules, db.ledgerEntries, db.imports], async () => {
    await Promise.all([db.transactions.clear(), db.merchantRules.clear(), db.ledgerEntries.clear(), db.imports.clear()]);
  });
  localStorage.removeItem('private-ledger:lastExportAt');
  window.dispatchEvent(new Event('private-ledger:export-changed'));
}
