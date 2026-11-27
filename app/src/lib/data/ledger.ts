// Privacy Ledger. Every model call writes one entry (a cloud call that is
// retried writes one per attempt). The counters
// shown in the Data Boundary panel are always computed from these entries,
// never hard-coded.

import { db, type LedgerEntry } from './db';

/** Feature names as they appear in the Privacy Ledger and the Data Boundary panel. */
export const FEATURE = {
  labeling: 'Sorting',
  cloudLabeling: 'Cloud sorting (with your OK)',
  explain: 'Explain merchant',
  guard: 'Privacy check',
  summary: 'Monthly summary',
  advisor: 'Advisor',
} as const;

export async function recordLedger(entry: Omit<LedgerEntry, 'id' | 'timestamp'>): Promise<void> {
  await db.ledgerEntries.add({ ...entry, timestamp: Date.now() });
}

export interface LedgerCounters {
  /** Raw rows of the user's own data that reached a cloud model. */
  rawSentUser: number;
  /** Raw demo rows sent to the cloud (counted apart from user data). */
  rawSentDemo: number;
  merchantNamesShared: number;
  blockedMessages: number;
  cloudRequests: number;
  onDeviceCalls: number;
  refusedCalls: number;
}

export function countLedger(entries: LedgerEntry[]): LedgerCounters {
  const counters: LedgerCounters = {
    rawSentUser: 0,
    rawSentDemo: 0,
    merchantNamesShared: 0,
    blockedMessages: 0,
    cloudRequests: 0,
    onDeviceCalls: 0,
    refusedCalls: 0,
  };
  for (const e of entries) {
    if (e.inferenceSource === 'in_cloud') {
      counters.cloudRequests += 1;
      if (e.isDemo) counters.rawSentDemo += e.rawRowCount;
      else counters.rawSentUser += e.rawRowCount;
      counters.merchantNamesShared += e.merchantNameCount;
    } else if (e.inferenceSource === 'on_device') {
      counters.onDeviceCalls += 1;
    } else if (e.inferenceSource === 'blocked') {
      counters.blockedMessages += 1;
    } else if (e.inferenceSource === 'refused') {
      counters.refusedCalls += 1;
    }
  }
  return counters;
}
