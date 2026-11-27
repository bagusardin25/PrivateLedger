// Runs on-device labeling over every pending merchant and keeps the Privacy Ledger exact:
// one entry per model call, plus an entry when a call is refused before sending.

import { db, type Transaction } from '../data/db';
import { BATCH_SIZE, labelBatch } from './labeler';
import { FEATURE, recordLedger } from '../data/ledger';
import { ON_DEVICE_MODEL } from './models';
import { getDeviceStatus } from './onDevice';
import type { ModelMerchant } from '../core/prepare';
import { createStore } from '../util/store';

export interface LabelingState {
  status: 'idle' | 'running' | 'done' | 'refused' | 'error';
  /** Where the current or last run labeled rows: on this device, or in the cloud with consent. */
  where?: 'device' | 'cloud';
  /** Rows labeled by the model in the current run. */
  done: number;
  total: number;
  batch: number;
  batches: number;
  firstItemMs?: number;
  message?: string;
}

export const labelingStore = createStore<LabelingState>({ status: 'idle', done: 0, total: 0, batch: 0, batches: 0 });

/** Tracks timestamps of rows newly labeled on-device so arrival animation plays once. */
export const recentArrivals = new Set<string>();

const ARRIVAL_MS = 2000;

/** Rows stay "just arrived" for two seconds, so the table can play the arrival glow once. */
export function markArrived(ids: string[]): void {
  for (const id of ids) recentArrivals.add(id);
  setTimeout(() => ids.forEach((id) => recentArrivals.delete(id)), ARRIVAL_MS);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Rows still waiting for a model, grouped so each merchant is labeled once. */
export async function collectPending() {
  const pending = await db.transactions.filter((t) => t.source === 'pending').toArray();
  const groups = new Map<string, Transaction[]>();
  for (const tx of pending) groups.set(tx.merchantKey, [...(groups.get(tx.merchantKey) ?? []), tx]);
  const merchants: ModelMerchant[] = [...groups.entries()].map(([key, rows]) => ({
    key,
    example: rows[0].rawDescription,
    direction: rows[0].amount >= 0 ? 'in' : 'out',
    rowCount: rows.length,
  }));
  const isDemo = pending.length > 0 && pending.every((t) => t.isDemo);
  return { pending, groups, merchants, isDemo };
}

export async function runOnDeviceLabeling(): Promise<void> {
  if (labelingStore.get().status === 'running') return;

  const { pending, groups, merchants, isDemo } = await collectPending();

  if (merchants.length === 0) {
    labelingStore.set({ status: 'done', done: 0, total: 0, batch: 0, batches: 0, message: undefined });
    return;
  }

  const status = await getDeviceStatus();
  if (status !== 'available') {
    await recordLedger({
      feature: FEATURE.labeling,
      mode: 'ONLY_ON_DEVICE',
      inferenceSource: 'refused',
      payloadPreview: `On-device AI is ${status}. ${pending.length} rows stay here unlabeled; nothing fell back to the cloud.`,
      bytes: 0,
      rawRowCount: 0,
      merchantNameCount: 0,
      consent: false,
      isDemo,
    });
    labelingStore.set({
      status: 'refused',
      done: 0,
      total: pending.length,
      batch: 0,
      batches: 0,
      message: `On-device AI is ${status}. ${pending.length} rows are waiting; nothing was sent anywhere.`,
    });
    return;
  }

  const profile = (await db.profile.get('me'))?.businessDescription ?? '';
  const batches = chunk(merchants, BATCH_SIZE);
  const runStart = performance.now();
  let done = 0;
  labelingStore.set({ status: 'running', where: 'device', done: 0, total: pending.length, batch: 0, batches: batches.length, firstItemMs: undefined, message: undefined });

  try {
    for (const [index, batch] of batches.entries()) {
      labelingStore.set({ batch: index + 1 });
      const result = await labelBatch(batch, profile, async (label) => {
        const rows = groups.get(label.key) ?? [];
        markArrived(rows.map((r) => r.id));
        await db.transactions.bulkUpdate(
          rows.map((r) => ({
            key: r.id,
            changes: {
              type: label.type,
              category: label.category,
              source: 'on-device' as const,
              needsReview: label.type === 'unsure',
              reviewReason: label.type === 'unsure' ? 'The on-device model was not sure' : undefined,
            },
          })),
        );
        done += rows.length;
        const first = labelingStore.get().firstItemMs ?? Math.round(performance.now() - runStart);
        labelingStore.set({ done, firstItemMs: first });
      });

      const rowsInBatch = batch.reduce((sum, m) => sum + m.rowCount, 0);
      // The guard should make this impossible; if it ever happens, the ledger says so.
      const reachedCloud = result.inferenceSource === 'in_cloud';
      await recordLedger({
        feature: FEATURE.labeling,
        mode: 'ONLY_ON_DEVICE',
        inferenceSource: reachedCloud ? 'in_cloud' : 'on_device',
        model: reachedCloud ? 'cloud (unexpected)' : ON_DEVICE_MODEL,
        payloadPreview: reachedCloud
          ? `Unexpected: ${rowsInBatch} rows reached the cloud.`
          : `${batch.length} merchants (${rowsInBatch} rows) labeled in this browser. The ${result.promptBytes}-byte prompt never left the device.`,
        bytes: result.promptBytes,
        rawRowCount: reachedCloud ? rowsInBatch : 0,
        merchantNameCount: reachedCloud ? batch.length : 0,
        consent: false,
        isDemo,
        durationMs: result.ms,
      });
    }

    // Merchants the model skipped go to the review queue instead of staying hidden.
    const leftover = await db.transactions.filter((t) => t.source === 'pending').toArray();
    if (leftover.length) {
      await db.transactions.bulkUpdate(
        leftover.map((t) => ({
          key: t.id,
          changes: { type: 'unsure' as const, source: 'on-device' as const, needsReview: true, reviewReason: 'No label from the on-device model' },
        })),
      );
    }
    labelingStore.set({ status: 'done' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    labelingStore.set({ status: 'error', message });
  }
}
