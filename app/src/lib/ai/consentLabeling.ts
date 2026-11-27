// Fallback with consent. When on-device AI is unavailable, raw rows never move
// to the cloud on their own. Only after the user agrees are they sent, and
// every request is logged as "sent with consent", with demo rows counted apart.

import { cloudRequest, friendlyCloudError } from './cloudCall';
import { db } from '../data/db';
import { buildLabelPrompt } from './labeler';
import { collectPending, labelingStore, markArrived } from './labelingRunner';
import { FEATURE } from '../data/ledger';
import { getConsentLabelerModel } from './models';
import { isCategory, isTxType } from '../core/taxonomy';
import { CLOUD_TIMEOUT_MS } from '../util/withTimeout';

const CLOUD_BATCH = 20;

/** The business profile never leaves the device, even on this path. */
const CLOUD_PROFILE = 'Freelancer. (The business profile stays on the device and is not shared.)';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface ConsentPreview {
  rows: number;
  merchants: number;
  requests: number;
  isDemo: boolean;
  /** The exact text of the first request, shown before the user agrees. */
  firstRequest: string;
}

export async function getConsentPreview(): Promise<ConsentPreview> {
  const { pending, merchants, isDemo } = await collectPending();
  return {
    rows: pending.length,
    merchants: merchants.length,
    requests: Math.ceil(merchants.length / CLOUD_BATCH),
    isDemo,
    firstRequest: buildLabelPrompt(merchants.slice(0, CLOUD_BATCH), CLOUD_PROFILE),
  };
}

export async function runCloudLabelingWithConsent(): Promise<void> {
  if (labelingStore.get().status === 'running') return;
  const { pending, groups, merchants, isDemo } = await collectPending();
  if (merchants.length === 0) return;

  const batches = chunk(merchants, CLOUD_BATCH);
  const start = performance.now();
  let done = 0;
  labelingStore.set({ status: 'running', where: 'cloud', done: 0, total: pending.length, batch: 0, batches: batches.length, firstItemMs: undefined, message: undefined });

  try {
    for (const [index, batch] of batches.entries()) {
      labelingStore.set({ batch: index + 1 });
      const prompt = buildLabelPrompt(batch, CLOUD_PROFILE);
      const idToKey = new Map(batch.map((m, i) => [`m${i + 1}`, m.key]));

      const result = await cloudRequest(
        {
          feature: FEATURE.cloudLabeling,
          mode: 'ONLY_IN_CLOUD',
          payloadPreview: prompt,
          bytes: new TextEncoder().encode(prompt).length,
          // One example row per merchant is sent; the label is applied to that merchant's other rows locally.
          rawRowCount: batch.length,
          merchantNameCount: batch.length,
          consent: true,
          isDemo,
        },
        () => getConsentLabelerModel().generateContent(prompt, { timeout: CLOUD_TIMEOUT_MS }),
        'Cloud AI',
      );

      let items: Record<string, unknown>[] = [];
      try {
        items = ((JSON.parse(result.response.text()) as { items?: unknown }).items ?? []) as Record<string, unknown>[];
      } catch {
        // An unreadable answer labels nothing; those rows go to the review queue below.
      }
      for (const item of items) {
        const key = typeof item.id === 'string' ? idToKey.get(item.id) : undefined;
        if (!key || !isTxType(item.type) || !isCategory(item.category)) continue;
        const { type, category } = item;
        const rows = groups.get(key) ?? [];
        markArrived(rows.map((r) => r.id));
        await db.transactions.bulkUpdate(
          rows.map((r) => ({
            key: r.id,
            changes: {
              type,
              category,
              source: 'cloud' as const,
              needsReview: type === 'unsure',
              reviewReason: type === 'unsure' ? "Cloud AI wasn't sure" : undefined,
            },
          })),
        );
        done += rows.length;
        labelingStore.set({ done, firstItemMs: labelingStore.get().firstItemMs ?? Math.round(performance.now() - start) });
      }
    }

    const leftover = await db.transactions.filter((t) => t.source === 'pending').toArray();
    if (leftover.length) {
      await db.transactions.bulkUpdate(
        leftover.map((t) => ({ key: t.id, changes: { type: 'unsure' as const, source: 'cloud' as const, needsReview: true, reviewReason: "Cloud AI couldn't sort this one" } })),
      );
    }
    labelingStore.set({ status: 'done' });
  } catch (error) {
    labelingStore.set({ status: 'error', message: friendlyCloudError(error) });
  }
}
