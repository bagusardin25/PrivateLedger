// F3 step 5: the on-device model labels each remaining merchant once.
// Variant S4 from the go/no-go speed test: slim schema, batch of 10, streaming.
// First row arrived after 2.0 s in that test.

import { getGenerativeModel, InferenceMode, type GenerativeModel } from 'firebase/ai';
import { getFirebase } from './firebase';
import { assertOnDeviceReady, TEXT_EN } from './onDevice';
import type { ModelMerchant } from './prepare';
import { CATEGORIES, isCategory, isTxType, type Category, type TxType } from './taxonomy';

export const BATCH_SIZE = 10;

const SYSTEM = [
  'You label bank transactions for a freelancer whose business and personal spending share one account.',
  'For every merchant return: id, type, category.',
  'type is "business" only if it is clearly a cost or income of the freelance business described in the profile.',
  'type is "personal" if it is clearly private: rent, groceries, entertainment, health, gym, streaming.',
  'type is "unsure" if it could reasonably be either, or if the profile does not clearly explain it.',
  'category must be exactly one value from the allowed list.',
  'Keep every id exactly as given, return one item per merchant, and never invent merchants.',
].join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['business', 'personal', 'unsure'] },
          category: { type: 'string', enum: [...CATEGORIES] },
        },
        required: ['id', 'type', 'category'],
      },
    },
  },
  required: ['items'],
};

let model: GenerativeModel | undefined;

/** `labeler` instance from PRD 7.1: ONLY_ON_DEVICE, never a cloud fallback. */
export function getLabelerModel(): GenerativeModel {
  model ??= getGenerativeModel(getFirebase().ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: TEXT_EN,
        expectedOutputs: TEXT_EN,
        initialPrompts: [{ role: 'system', content: [{ type: 'text', value: SYSTEM }] }],
      },
      promptOptions: { responseConstraint: SCHEMA },
    },
  });
  return model;
}

/** Must be called from a click handler: Chrome requires user activation to start the download. */
export function initializeOnDeviceModel(onProgress: (value: number) => void): Promise<void> {
  return getLabelerModel().initializeDeviceModel(onProgress);
}

export interface MerchantLabel {
  key: string;
  type: TxType;
  category: Category;
}

export interface BatchResult {
  ms: number;
  firstItemMs?: number;
  inferenceSource?: string;
  promptBytes: number;
  labeled: number;
}

/** Matches complete item objects in partial streamed JSON. */
const COMPLETE_ITEM = /\{[^{}]*"id"\s*:\s*"[^"]*"[^{}]*\}/g;

function buildPrompt(batch: ModelMerchant[], profile: string): string {
  const rows = batch.map((m, i) => `m${i + 1} | ${m.example} | money ${m.direction}`).join('\n');
  return [
    `Business profile: ${profile || 'Freelancer. No profile given, so be careful with "business".'}`,
    `Allowed categories: ${CATEGORIES.join('; ')}`,
    `Label each of these ${batch.length} merchants (id | example bank description | money in or out):`,
    rows,
  ].join('\n\n');
}

/**
 * Labels one batch on-device and calls `onItem` as soon as each item is complete
 * in the stream, so rows appear one by one in the table.
 */
export async function labelBatch(
  batch: ModelMerchant[],
  profile: string,
  onItem: (label: MerchantLabel) => Promise<void> | void,
): Promise<BatchResult> {
  await assertOnDeviceReady();
  const prompt = buildPrompt(batch, profile);
  const idToKey = new Map(batch.map((m, i) => [`m${i + 1}`, m.key]));
  const seen = new Set<string>();
  const start = performance.now();
  let firstItemMs: number | undefined;
  let output = '';

  const handle = async (text: string) => {
    for (const match of text.matchAll(COMPLETE_ITEM)) {
      let item: Record<string, unknown>;
      try {
        item = JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        continue;
      }
      const key = typeof item.id === 'string' ? idToKey.get(item.id) : undefined;
      if (!key || seen.has(key) || !isTxType(item.type) || !isCategory(item.category)) continue;
      seen.add(key);
      firstItemMs ??= Math.round(performance.now() - start);
      await onItem({ key, type: item.type, category: item.category });
    }
  };

  const result = await getLabelerModel().generateContentStream(prompt);
  for await (const chunk of result.stream) {
    const piece = chunk.text();
    // Chrome has sent both cumulative and incremental chunks over time; handle either.
    output = piece.startsWith(output) ? piece : output + piece;
    await handle(output);
  }
  const final = await result.response;
  await handle(output);

  return {
    ms: Math.round(performance.now() - start),
    firstItemMs,
    inferenceSource: final.inferenceSource,
    promptBytes: new TextEncoder().encode(prompt).length,
    labeled: seen.size,
  };
}
