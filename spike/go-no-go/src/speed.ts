// Speed comparison for F3. The first run showed 27–36 s per batch of 20, mostly
// spent writing JSON. These variants shrink the output and change batch size or
// streaming, and measure accuracy alongside time so a faster option is not
// picked at the cost of correctness.

import { getGenerativeModel, InferenceMode, type AI, type GenerativeModel } from 'firebase/ai';
import { BUSINESS_PROFILE, CATEGORIES, TRANSACTIONS, type Category, type TestTransaction } from './data';
import { labelJsonSchema, onDevice } from './models';
import { assertOnDeviceReady, TEXT_EN } from './onDevice';
import { THRESHOLDS, type Gate, type Log, type Verdict } from './tests';

const CATEGORY_CODES: Record<string, Category> = {
  SW: 'Software & Subscriptions',
  EQ: 'Equipment',
  OF: 'Office & Coworking',
  TR: 'Travel',
  ME: 'Meals',
  PS: 'Professional Services',
  MK: 'Marketing',
  FE: 'Fees & Bank Charges',
  TX: 'Taxes',
  IN: 'Income',
  XF: 'Transfers',
  GR: 'Groceries',
  HU: 'Housing & Utilities',
  HE: 'Health',
  SE: 'Shopping & Entertainment',
  OT: 'Other',
};
const TYPE_CODES: Record<string, string> = { B: 'business', P: 'personal', U: 'unsure' };

interface Label {
  type?: string;
  category?: string;
}

interface Variant {
  id: string;
  label: string;
  batchSize: number;
  stream: boolean;
  fields: string;
  schema: object;
  categoryLegend: string;
  parseItem: (item: Record<string, unknown>) => Label;
}

const fullLegend = `Allowed categories: ${CATEGORIES.join('; ')}`;
const codeLegend = `Category codes: ${Object.entries(CATEGORY_CODES).map(([code, name]) => `${code} = ${name}`).join('; ')}`;

const slimSchema = {
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

const compactSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          t: { type: 'string', enum: Object.keys(TYPE_CODES) },
          c: { type: 'string', enum: Object.keys(CATEGORY_CODES) },
        },
        required: ['id', 't', 'c'],
      },
    },
  },
  required: ['items'],
};

const typeOnlySchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['business', 'personal', 'unsure'] },
        },
        required: ['id', 'type'],
      },
    },
  },
  required: ['items'],
};

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);
const fullItem = (item: Record<string, unknown>): Label => ({ type: asString(item.type), category: asString(item.category) });

const VARIANTS: Variant[] = [
  {
    id: 'S1', label: 'Baseline: full schema, batch 20', batchSize: 20, stream: false,
    fields: 'id, cleanMerchant, type, category, confidence', schema: labelJsonSchema, categoryLegend: fullLegend, parseItem: fullItem,
  },
  {
    id: 'S2', label: 'Slim schema (id, type, category), batch 20', batchSize: 20, stream: false,
    fields: 'id, type, category', schema: slimSchema, categoryLegend: fullLegend, parseItem: fullItem,
  },
  {
    id: 'S3', label: 'Slim schema, batch 10', batchSize: 10, stream: false,
    fields: 'id, type, category', schema: slimSchema, categoryLegend: fullLegend, parseItem: fullItem,
  },
  {
    id: 'S4', label: 'Slim schema, batch 10, streaming', batchSize: 10, stream: true,
    fields: 'id, type, category', schema: slimSchema, categoryLegend: fullLegend, parseItem: fullItem,
  },
  {
    id: 'S5', label: 'Short codes (t = B/P/U, c = 2-letter code), batch 20', batchSize: 20, stream: false,
    fields: 'id, t (B = business, P = personal, U = unsure), c (category code)', schema: compactSchema, categoryLegend: codeLegend,
    parseItem: (item) => ({ type: TYPE_CODES[asString(item.t) ?? ''], category: CATEGORY_CODES[asString(item.c) ?? ''] }),
  },
  {
    id: 'S6', label: 'Business/personal only (no category), batch 20', batchSize: 20, stream: false,
    fields: 'id, type', schema: typeOnlySchema, categoryLegend: '', parseItem: (item) => ({ type: asString(item.type) }),
  },
];

function systemPrompt(variant: Variant): string {
  return [
    'You label bank transactions for a freelancer whose business and personal spending share one account.',
    `For every transaction return these fields: ${variant.fields}.`,
    'Type is business if it is clearly a cost or income of the freelance business, personal if it is clearly private, unsure if it could reasonably be either.',
    'Keep every id exactly as given, return one item per transaction, and never invent transactions.',
  ].join('\n');
}

function prompt(variant: Variant, batch: TestTransaction[]): string {
  const rows = batch.map((tx) => `${tx.id} | ${tx.date} | ${tx.description} | ${tx.amount.toFixed(2)}`).join('\n');
  return [
    `Business profile: ${BUSINESS_PROFILE}`,
    variant.categoryLegend,
    `Label each of these ${batch.length} transactions (id | date | description | amount; negative means money out):`,
    rows,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parse(variant: Variant, text: string, ids: string[]) {
  const labels = new Map<string, Label>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, problems: ['not valid JSON'], labels };
  }
  const list = (parsed as { items?: unknown }).items;
  if (!Array.isArray(list)) return { valid: false, problems: ['missing items array'], labels };
  const problems: string[] = [];
  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const id = asString(item.id);
    if (!id || !ids.includes(id)) {
      problems.push(`unexpected id ${String(item.id)}`);
      continue;
    }
    const label = variant.parseItem(item);
    if (!label.type) problems.push(`${id}: invalid type`);
    if (variant.categoryLegend && !label.category) problems.push(`${id}: invalid category`);
    labels.set(id, label);
  }
  for (const id of ids) if (!labels.has(id)) problems.push(`missing ${id}`);
  return { valid: problems.length === 0, problems, labels };
}

/** Matches the first complete item object in partial streamed JSON. */
const COMPLETE_ITEM = /\{[^{}]*"id"\s*:\s*"[^"]*"[^{}]*\}/;

async function callBatch(model: GenerativeModel, variant: Variant, text: string) {
  const start = performance.now();
  if (!variant.stream) {
    const result = await model.generateContent(text);
    const ms = Math.round(performance.now() - start);
    return { text: result.response.text(), ms, firstRowMs: ms, source: result.response.inferenceSource };
  }
  const result = await model.generateContentStream(text);
  let output = '';
  let firstRowMs: number | undefined;
  for await (const chunk of result.stream) {
    const piece = chunk.text();
    // Chrome has sent both cumulative and incremental chunks over time; handle either.
    output = piece.startsWith(output) ? piece : output + piece;
    if (firstRowMs === undefined && COMPLETE_ITEM.test(output)) firstRowMs = Math.round(performance.now() - start);
  }
  const final = await result.response;
  const ms = Math.round(performance.now() - start);
  return { text: output, ms, firstRowMs: firstRowMs ?? ms, source: final.inferenceSource };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export async function runSpeedComparison(ai: AI, log: Log) {
  const gates: Gate[] = [];
  const details: Record<string, unknown>[] = [];

  // Warm-up and fixed cost: tiny prompts with the same session settings.
  const plain = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: { createOptions: { expectedInputs: TEXT_EN, expectedOutputs: TEXT_EN } },
  });
  const overhead: number[] = [];
  for (let i = 0; i < 4; i++) {
    await assertOnDeviceReady();
    const start = performance.now();
    await plain.generateContent('Reply with the single word OK.');
    overhead.push(Math.round(performance.now() - start));
  }
  const fixedMs = median(overhead.slice(1)); // first call is warm-up
  log(`Fixed cost per call (median of 3 after warm-up): ${fixedMs} ms`);
  gates.push({
    id: 'S0', kind: 'info', name: 'Fixed cost per on-device call', threshold: 'Session creation + tiny reply',
    verdict: 'PASS', summary: `${fixedMs} ms per call (warm-up call: ${overhead[0]} ms).`,
  });

  const clear = TRANSACTIONS.filter((tx) => tx.expectedType !== 'ambiguous');
  const results: { variant: Variant; per20Ms: number; firstRowMs: number; typeAccuracy: number; valid: boolean }[] = [];

  for (const variant of VARIANTS) {
    const model = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: onDevice(systemPrompt(variant), variant.schema),
    });
    const labels = new Map<string, Label>();
    const batches: { ms: number; firstRowMs: number; valid: boolean; problems: string[]; source?: string; error?: string }[] = [];

    for (const batch of chunk(TRANSACTIONS, variant.batchSize)) {
      const ids = batch.map((tx) => tx.id);
      try {
        await assertOnDeviceReady();
        const out = await callBatch(model, variant, prompt(variant, batch));
        const check = parse(variant, out.text, ids);
        check.labels.forEach((label, id) => labels.set(id, label));
        batches.push({ ms: out.ms, firstRowMs: out.firstRowMs, valid: check.valid, problems: check.problems.slice(0, 5), source: out.source });
      } catch (error) {
        batches.push({ ms: 0, firstRowMs: 0, valid: false, problems: [], error: error instanceof Error ? error.message : String(error) });
      }
    }

    const totalMs = batches.reduce((sum, b) => sum + b.ms, 0);
    const per20Ms = Math.round((totalMs / TRANSACTIONS.length) * 20);
    const firstRowMs = batches[0]?.firstRowMs ?? 0;
    const valid = batches.every((b) => b.valid);
    const typeCorrect = clear.filter((tx) => labels.get(tx.id)?.type === tx.expectedType).length;
    const typeAccuracy = typeCorrect / clear.length;
    const categoryCorrect = TRANSACTIONS.filter((tx) => labels.get(tx.id)?.category === tx.expectedCategory).length;
    const categoryText = variant.categoryLegend ? `${Math.round((categoryCorrect / TRANSACTIONS.length) * 100)}%` : 'n/a';
    const accurate = typeAccuracy >= THRESHOLDS.minTypeAccuracy;
    const fast = per20Ms < THRESHOLDS.maxBatchMs;

    let verdict: Verdict = 'FAIL';
    if (valid && accurate) verdict = fast ? 'PASS' : 'WARN';

    const errorText = batches.find((b) => b.error)?.error ?? batches.find((b) => !b.valid)?.problems.join('; ');
    gates.push({
      id: variant.id, kind: 'info', name: variant.label,
      threshold: `Valid JSON, type accuracy ≥ ${Math.round(THRESHOLDS.minTypeAccuracy * 100)}%, under ${seconds(THRESHOLDS.maxBatchMs)} per 20 rows`,
      verdict,
      summary:
        `${seconds(per20Ms)} per 20 rows (40 rows: ${seconds(totalMs)}); first row after ${seconds(firstRowMs)}; ` +
        `type ${typeCorrect}/${clear.length} (${Math.round(typeAccuracy * 100)}%); category ${categoryText}; ` +
        `${valid ? 'JSON valid' : `invalid: ${errorText}`}.`,
    });
    log(`${variant.id} ${variant.label}: ${seconds(per20Ms)}/20 rows, first row ${seconds(firstRowMs)}, type ${Math.round(typeAccuracy * 100)}%, ${valid ? 'valid' : 'invalid'}`);
    results.push({ variant, per20Ms, firstRowMs, typeAccuracy, valid });
    details.push({
      id: variant.id,
      label: variant.label,
      batchSize: variant.batchSize,
      stream: variant.stream,
      totalMs,
      per20Ms,
      firstRowMs,
      typeAccuracy: Math.round(typeAccuracy * 1000) / 1000,
      categoryAccuracy: variant.categoryLegend ? Math.round((categoryCorrect / TRANSACTIONS.length) * 1000) / 1000 : null,
      batches,
      wrongType: clear
        .filter((tx) => labels.get(tx.id)?.type !== tx.expectedType)
        .map((tx) => ({ id: tx.id, description: tx.description, expected: tx.expectedType, got: labels.get(tx.id)?.type })),
    });
  }

  const usable = results.filter((r) => r.valid && r.typeAccuracy >= THRESHOLDS.minTypeAccuracy);
  const best = [...usable].sort((a, b) => a.per20Ms - b.per20Ms)[0];
  const quickestFirstRow = [...usable].sort((a, b) => a.firstRowMs - b.firstRowMs)[0];
  let bestVerdict: Verdict = 'FAIL';
  let bestSummary = 'No variant kept valid JSON and type accuracy at the threshold.';
  if (best) {
    bestVerdict = best.per20Ms < THRESHOLDS.maxBatchMs ? 'PASS' : quickestFirstRow.firstRowMs < 5_000 ? 'WARN' : 'FAIL';
    bestSummary =
      `Fastest usable: ${best.variant.id} (${best.variant.label}) at ${seconds(best.per20Ms)} per 20 rows. ` +
      `Quickest first row: ${quickestFirstRow.variant.id} after ${seconds(quickestFirstRow.firstRowMs)}.`;
  }
  gates.push({
    id: 'S9', kind: 'info', name: 'Best speed option',
    threshold: `PASS: a usable variant under ${seconds(THRESHOLDS.maxBatchMs)} per 20 rows. WARN: none, but a first row in under 5 s`,
    verdict: bestVerdict, summary: bestSummary,
  });

  return { gates, details: { speed: { fixedCallMs: fixedMs, warmupMs: overhead[0], variants: details } } };
}
