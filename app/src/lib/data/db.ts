// Local storage (IndexedDB through Dexie). Everything here stays in the browser.
// Nothing in these tables is ever synced to a server.

import Dexie, { type EntityTable } from 'dexie';
import type { LabelSource } from '../core/prepare';
import type { Category, TxType } from '../core/taxonomy';
import { resetLedgerCurrency } from '../util/ledgerCurrency';

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
  /** ISO 4217 code. Missing on imports made before currencies were tracked, which were USD. */
  currency?: string;
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

/**
 * Removes the transactions and their imports, but keeps what is still true for
 * new ones: merchants you sorted (memory) and the Privacy Ledger, the record of
 * what left this device. Used when a file in another currency replaces the old one.
 */
export async function clearTransactions(): Promise<void> {
  await db.transaction('rw', [db.transactions, db.imports], async () => {
    await Promise.all([db.transactions.clear(), db.imports.clear()]);
  });
  localStorage.removeItem('private-ledger:lastExportAt');
  resetLedgerCurrency();
  window.dispatchEvent(new Event('private-ledger:export-changed'));
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.transactions, db.merchantRules, db.ledgerEntries, db.imports], async () => {
    await Promise.all([db.transactions.clear(), db.merchantRules.clear(), db.ledgerEntries.clear(), db.imports.clear()]);
  });
  localStorage.removeItem('private-ledger:lastExportAt');
  resetLedgerCurrency();
  window.dispatchEvent(new Event('private-ledger:export-changed'));
}
