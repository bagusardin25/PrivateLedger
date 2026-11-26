import type { AI, FunctionCall, Part } from 'firebase/ai';
import {
  BUSINESS_PROFILE,
  CATEGORIES,
  CONFIDENCE,
  EXPLAIN_CASES,
  GUARD_CASES,
  TRANSACTIONS,
  TYPES,
  businessPersonalSplit,
  spendingByCategory,
  type TestTransaction,
} from './data';
import { deterministicGuard, merchantTokens } from './guard';
import {
  ADVISOR_MODEL,
  CLOUD_MODELS,
  REPORTER_MODEL,
  createAdvisor,
  createPingModel,
  createPreferOnDevice,
  createReporter,
  type Models,
} from './models';
import { assertOnDeviceReady, getDeviceStatus } from './onDevice';

export type Verdict = 'PASS' | 'WARN' | 'FAIL' | 'SKIP';

export interface Gate {
  id: string;
  kind: 'gate' | 'info';
  name: string;
  threshold: string;
  verdict: Verdict;
  summary: string;
}

export type Log = (line: string) => void;

/** Proposed thresholds from PRD section 13. */
export const THRESHOLDS = {
  maxBatchMs: 15_000,
  minTypeAccuracy: 0.8,
  warnTypeAccuracy: 0.7,
  maxGuardFalsePositives: 1,
};

const BATCH_SIZE = 20;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True for "model busy" (500/503) and quota (429) errors, which say nothing about whether a feature works. */
export function isCapacityError(text: string | undefined): boolean {
  return /\[(429|500|503)\b/.test(text ?? '') || /high demand|exceeded your current quota/i.test(text ?? '');
}

/** Keeps the original details key for the PRD model run, and a separate key for other models. */
function detailKey(base: string, id: string, primaryId: string): string {
  return id === primaryId ? base : `${base}_${id}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

// ---------------------------------------------------------------------------
// F3: business/personal labeling, ONLY_ON_DEVICE
// ---------------------------------------------------------------------------

interface LabelItem {
  id: string;
  cleanMerchant: string;
  type: string;
  category: string;
  confidence: string;
}

function labelPrompt(batch: TestTransaction[]): string {
  const rows = batch.map((tx) => `${tx.id} | ${tx.date} | ${tx.description} | ${tx.amount.toFixed(2)}`).join('\n');
  return [
    `Business profile: ${BUSINESS_PROFILE}`,
    `Allowed categories: ${CATEGORIES.join('; ')}`,
    `Label each of these ${batch.length} transactions (id | date | description | amount; negative means money out):`,
    rows,
  ].join('\n\n');
}

function validateLabels(text: string, expectedIds: string[]) {
  const items = new Map<string, LabelItem>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, problems: ['response is not valid JSON'], items };
  }
  const list = (parsed as { items?: unknown }).items;
  if (!Array.isArray(list)) return { valid: false, problems: ['missing "items" array'], items };

  const problems: string[] = [];
  const isOneOf = (allowed: readonly string[], value: unknown) => typeof value === 'string' && allowed.includes(value);
  for (const raw of list) {
    const item = raw as Partial<LabelItem>;
    if (typeof item.id !== 'string') {
      problems.push('item without an id');
      continue;
    }
    if (!expectedIds.includes(item.id)) problems.push(`unexpected id ${item.id}`);
    if (items.has(item.id)) problems.push(`duplicate id ${item.id}`);
    if (!isOneOf(TYPES, item.type)) problems.push(`${item.id}: invalid type "${item.type}"`);
    if (!isOneOf(CATEGORIES, item.category)) problems.push(`${item.id}: invalid category "${item.category}"`);
    if (!isOneOf(CONFIDENCE, item.confidence)) problems.push(`${item.id}: invalid confidence "${item.confidence}"`);
    if (typeof item.cleanMerchant !== 'string') problems.push(`${item.id}: missing cleanMerchant`);
    items.set(item.id, item as LabelItem);
  }
  for (const id of expectedIds) if (!items.has(id)) problems.push(`missing ${id}`);
  return { valid: problems.length === 0, problems, items };
}

export async function runLabelerTest(models: Models, log: Log) {
  const batches = chunk(TRANSACTIONS, BATCH_SIZE);
  const batchResults: {
    ids: string[];
    latencyMs?: number;
    inferenceSource?: string;
    valid: boolean;
    problems: string[];
    error?: string;
    invalidResponseSample?: string;
  }[] = [];
  const predicted = new Map<string, LabelItem>();

  for (const [index, batch] of batches.entries()) {
    const ids = batch.map((tx) => tx.id);
    log(`F3 batch ${index + 1}/${batches.length}: ${batch.length} transactions`);
    try {
      await assertOnDeviceReady();
      const { value: result, ms } = await timed(() => models.labeler.generateContent(labelPrompt(batch)));
      const text = result.response.text();
      const check = validateLabels(text, ids);
      check.items.forEach((item, id) => predicted.set(id, item));
      batchResults.push({
        ids,
        latencyMs: ms,
        inferenceSource: result.response.inferenceSource,
        valid: check.valid,
        problems: check.problems,
        invalidResponseSample: check.valid ? undefined : text.slice(0, 2000),
      });
      log(`  ${ms} ms, source ${result.response.inferenceSource}, ${check.valid ? 'valid JSON' : `invalid: ${check.problems.slice(0, 3).join('; ')}`}`);
    } catch (error) {
      batchResults.push({ ids, valid: false, problems: [], error: errorMessage(error) });
      log(`  error: ${errorMessage(error)}`);
    }
  }

  const clear = TRANSACTIONS.filter((tx) => tx.expectedType !== 'ambiguous');
  const ambiguous = TRANSACTIONS.filter((tx) => tx.expectedType === 'ambiguous');
  const typeOf = (tx: TestTransaction) => predicted.get(tx.id)?.type;
  const correct = clear.filter((tx) => typeOf(tx) === tx.expectedType).length;
  const opposite = clear.filter((tx) => {
    const type = typeOf(tx);
    return type !== undefined && type !== 'unsure' && type !== tx.expectedType;
  }).length;
  const unsureOnClear = clear.filter((tx) => typeOf(tx) === 'unsure').length;
  const categoryCorrect = TRANSACTIONS.filter((tx) => predicted.get(tx.id)?.category === tx.expectedCategory).length;
  const latencies = batchResults.flatMap((b) => (b.latencyMs === undefined ? [] : [b.latencyMs]));
  const accuracy = clear.length ? correct / clear.length : 0;

  const metrics = {
    clearRows: clear.length,
    correctTypeOnClearRows: correct,
    strictTypeAccuracy: Math.round(accuracy * 1000) / 1000,
    oppositeTypeOnClearRows: opposite,
    unsureOnClearRows: unsureOnClear,
    ambiguousRows: ambiguous.length,
    ambiguousMarkedUnsure: ambiguous.filter((tx) => typeOf(tx) === 'unsure').length,
    categoryAccuracy: Math.round((categoryCorrect / TRANSACTIONS.length) * 1000) / 1000,
    batchLatenciesMs: latencies,
    medianBatchMs: latencies.length ? median(latencies) : null,
    maxBatchMs: latencies.length ? Math.max(...latencies) : null,
  };

  const firstError = batchResults.find((b) => b.error)?.error;
  const onDeviceAnswered = batchResults.some((b) => b.inferenceSource === 'on_device');
  const gates: Gate[] = [];

  gates.push({
    id: 'G1',
    kind: 'gate',
    name: 'On-device model answers',
    threshold: 'At least one ONLY_ON_DEVICE response with inferenceSource "on_device"',
    verdict: onDeviceAnswered ? 'PASS' : 'FAIL',
    summary: onDeviceAnswered ? 'Gemini Nano answered through Firebase AI Logic.' : `No on-device answer. ${firstError ?? ''}`.trim(),
  });

  if (!onDeviceAnswered) {
    for (const [id, name] of [
      ['G2', 'F3 JSON always valid'],
      ['G3', 'F3 speed per batch'],
      ['G4', 'F3 business/personal accuracy'],
    ] as const) {
      gates.push({ id, kind: 'gate', name, threshold: '', verdict: 'SKIP', summary: 'Needs a working on-device model (G1).' });
    }
    return { gates, details: { batches: batchResults, metrics, predictions: [] } };
  }

  const allValid = batchResults.every((b) => b.valid);
  gates.push({
    id: 'G2',
    kind: 'gate',
    name: 'F3 JSON always valid',
    threshold: `Every batch of ${BATCH_SIZE} returns JSON matching the schema, with every id`,
    verdict: allValid ? 'PASS' : 'FAIL',
    summary: allValid
      ? `${batchResults.length}/${batchResults.length} batches valid.`
      : batchResults
          .filter((b) => !b.valid)
          .map((b) => b.error ?? b.problems.slice(0, 4).join('; '))
          .join(' | '),
  });

  const maxMs = metrics.maxBatchMs ?? Infinity;
  const medianMs = metrics.medianBatchMs ?? Infinity;
  gates.push({
    id: 'G3',
    kind: 'gate',
    name: 'F3 speed per batch',
    threshold: `Under ${THRESHOLDS.maxBatchMs / 1000} s per batch of ${BATCH_SIZE}`,
    verdict: maxMs < THRESHOLDS.maxBatchMs ? 'PASS' : medianMs < THRESHOLDS.maxBatchMs ? 'WARN' : 'FAIL',
    summary: `Batches took ${latencies.map((ms) => `${(ms / 1000).toFixed(1)} s`).join(', ')}.`,
  });

  gates.push({
    id: 'G4',
    kind: 'gate',
    name: 'F3 business/personal accuracy',
    threshold: `At least ${pct(THRESHOLDS.minTypeAccuracy)} of clear rows correct ("unsure" counts as wrong)`,
    verdict:
      accuracy >= THRESHOLDS.minTypeAccuracy ? 'PASS' : accuracy >= THRESHOLDS.warnTypeAccuracy ? 'WARN' : 'FAIL',
    summary:
      `${correct}/${clear.length} clear rows correct (${pct(accuracy)}). ${opposite} labeled as the opposite type, ` +
      `${unsureOnClear} marked unsure. Category accuracy ${pct(metrics.categoryAccuracy)} (not a gate).`,
  });

  const predictions = TRANSACTIONS.map((tx) => {
    const p = predicted.get(tx.id);
    return {
      id: tx.id,
      description: tx.description,
      expectedType: tx.expectedType,
      predictedType: p?.type,
      expectedCategory: tx.expectedCategory,
      predictedCategory: p?.category,
      confidence: p?.confidence,
      cleanMerchant: p?.cleanMerchant,
    };
  });

  return { gates, details: { batches: batchResults, metrics, predictions } };
}

// ---------------------------------------------------------------------------
// F7: explain a merchant without making things up, ONLY_ON_DEVICE
// ---------------------------------------------------------------------------

export async function runExplainerTest(models: Models, log: Log) {
  const rows: {
    merchant: string;
    real: boolean;
    known?: boolean;
    explanation?: string;
    latencyMs?: number;
    error?: string;
  }[] = [];

  for (const testCase of EXPLAIN_CASES) {
    try {
      await assertOnDeviceReady();
      const { value: result, ms } = await timed(() => models.explainer.generateContent(`Merchant: ${testCase.merchant}`));
      const parsed = JSON.parse(result.response.text()) as { known?: unknown; explanation?: unknown };
      rows.push({
        ...testCase,
        known: parsed.known === true,
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : undefined,
        latencyMs: ms,
      });
      log(`F7 ${testCase.merchant}: known=${parsed.known} (${ms} ms)`);
    } catch (error) {
      rows.push({ ...testCase, error: errorMessage(error) });
      log(`F7 ${testCase.merchant}: error ${errorMessage(error)}`);
    }
  }

  const answered = rows.filter((row) => row.error === undefined);
  const fabrications = answered.filter((row) => !row.real && row.known).length;
  const realCases = EXPLAIN_CASES.filter((c) => c.real).length;
  const recognised = answered.filter((row) => row.real && row.known).length;

  let verdict: Verdict;
  if (answered.length === 0) verdict = 'SKIP';
  else if (fabrications >= 2) verdict = 'FAIL';
  else if (fabrications === 1 || recognised < realCases - 1) verdict = 'WARN';
  else verdict = 'PASS';

  const gate: Gate = {
    id: 'G5',
    kind: 'gate',
    name: 'F7 does not make up merchants',
    threshold: `0 invented merchants claimed as known, and at least ${realCases - 1}/${realCases} real ones recognised`,
    verdict,
    summary:
      answered.length === 0
        ? `No answers. ${rows[0]?.error ?? ''}`.trim()
        : `${fabrications}/${EXPLAIN_CASES.length - realCases} invented merchants claimed as known; ${recognised}/${realCases} real merchants recognised.`,
  };
  return { gates: [gate], details: { explainer: rows } };
}

// ---------------------------------------------------------------------------
// F9a: outgoing-message guard (deterministic layer + ONLY_ON_DEVICE classifier)
// ---------------------------------------------------------------------------

export async function runGuardTest(models: Models, log: Log) {
  const tokens = merchantTokens(TRANSACTIONS.map((tx) => tx.description));
  const rows: {
    message: string;
    containsTransactionData: boolean;
    deterministicBlock: boolean;
    deterministicReasons: string[];
    modelBlock?: boolean;
    modelError?: string;
  }[] = [];

  for (const testCase of GUARD_CASES) {
    const deterministic = deterministicGuard(testCase.message, tokens);
    let modelBlock: boolean | undefined;
    let modelError: string | undefined;
    try {
      await assertOnDeviceReady();
      const result = await models.guard.generateContent(`Message:\n"""\n${testCase.message}\n"""`);
      const parsed = JSON.parse(result.response.text()) as { verdict?: unknown };
      modelBlock = parsed.verdict === 'contains_transaction_data';
    } catch (error) {
      modelError = errorMessage(error);
    }
    rows.push({
      ...testCase,
      deterministicBlock: deterministic.block,
      deterministicReasons: deterministic.reasons,
      modelBlock,
      modelError,
    });
    log(`F9a ${testCase.containsTransactionData ? 'unsafe' : 'safe  '} rules=${deterministic.block ? 'block' : 'allow'} model=${modelBlock === undefined ? 'n/a' : modelBlock ? 'block' : 'allow'}`);
  }

  const positives = rows.filter((r) => r.containsTransactionData);
  const negatives = rows.filter((r) => !r.containsTransactionData);
  const score = (blocked: (r: (typeof rows)[number]) => boolean) => ({
    caught: positives.filter(blocked).length,
    falsePositives: negatives.filter(blocked).length,
  });
  const rules = score((r) => r.deterministicBlock);
  const modelAvailable = rows.some((r) => r.modelBlock !== undefined);
  const model = modelAvailable ? score((r) => r.modelBlock === true) : undefined;
  const combined = score((r) => r.deterministicBlock || r.modelBlock === true);

  const passed = combined.caught === positives.length && combined.falsePositives <= THRESHOLDS.maxGuardFalsePositives;
  const gate: Gate = {
    id: 'G6',
    kind: 'gate',
    name: 'F9a guard blocks pasted transactions',
    threshold: `Rules + model together catch ${positives.length}/${positives.length} unsafe messages, at most ${THRESHOLDS.maxGuardFalsePositives} false block`,
    verdict: !modelAvailable ? (passed ? 'WARN' : 'FAIL') : passed ? 'PASS' : 'FAIL',
    summary:
      `Combined: caught ${combined.caught}/${positives.length}, ${combined.falsePositives} false blocks. ` +
      `Rules only: ${rules.caught}/${positives.length}, ${rules.falsePositives} false. ` +
      (model
        ? `Model only: ${model.caught}/${positives.length}, ${model.falsePositives} false.`
        : 'Model layer not tested (no on-device model).') +
      ' Rules were written next to these messages, so their score is optimistic.',
  };
  return { gates: [gate], details: { guard: rows } };
}

// ---------------------------------------------------------------------------
// Cloud checks (need a real Firebase project and App Check debug token)
// ---------------------------------------------------------------------------

export async function runCloudPing(ai: AI, log: Log) {
  const rows: { model: string; ok: boolean; latencyMs?: number; reply?: string; inferenceSource?: string; error?: string }[] = [];
  for (const model of CLOUD_MODELS) {
    try {
      const { value: result, ms } = await timed(() =>
        createPingModel(ai, model).generateContent('Reply with the single word OK.'),
      );
      rows.push({ model, ok: true, latencyMs: ms, reply: result.response.text().slice(0, 40), inferenceSource: result.response.inferenceSource });
      log(`Cloud ${model}: OK (${ms} ms)`);
    } catch (error) {
      rows.push({ model, ok: false, error: errorMessage(error) });
      log(`Cloud ${model}: ${errorMessage(error)}`);
    }
  }
  const ok = rows.filter((r) => r.ok).length;
  const gate: Gate = {
    id: 'G7',
    kind: 'gate',
    name: 'Cloud models answer on the free tier',
    threshold: `All ${CLOUD_MODELS.length} PRD models answer through Firebase AI Logic`,
    verdict: ok === rows.length ? 'PASS' : ok > 0 ? 'WARN' : 'FAIL',
    summary: rows.map((r) => (r.ok ? `${r.model}: OK` : `${r.model}: ${r.error}`)).join(' | '),
  };
  return { gates: [gate], details: { cloudPing: rows } };
}

export async function runReporterCheck(ai: AI, log: Log, model: string = REPORTER_MODEL, id = 'I1') {
  const payload = {
    period: '2026-10',
    split: businessPersonalSplit('2026-10'),
    businessByCategory: spendingByCategory('2026-10', 'business').totals,
    previousPeriod: 'not available',
  };
  const prompt = `Monthly totals (no individual transactions):\n${JSON.stringify(payload, null, 2)}`;
  const name = `F8 cloud structured output (PREFER_IN_CLOUD), ${model}`;
  const threshold = 'JSON matches the report schema';
  const key = detailKey('reporter', id, 'I1');
  try {
    const { value: result, ms } = await timed(() => createReporter(ai, model).generateContent(prompt));
    const parsed = JSON.parse(result.response.text()) as { headline?: unknown; highlights?: unknown; warnings?: unknown };
    const valid = typeof parsed.headline === 'string' && Array.isArray(parsed.highlights) && Array.isArray(parsed.warnings);
    log(`F8 reporter (${model}): ${valid ? 'valid JSON' : 'invalid JSON'} via ${result.response.inferenceSource} (${ms} ms)`);
    return {
      gates: [{
        id, kind: 'info' as const, name, threshold,
        verdict: (valid ? 'PASS' : 'FAIL') as Verdict,
        summary: `${valid ? 'Valid' : 'Invalid'} JSON via ${result.response.inferenceSource} in ${ms} ms. Payload held totals only.`,
      }],
      details: { [key]: { model, sentPrompt: prompt, response: parsed, inferenceSource: result.response.inferenceSource, latencyMs: ms } },
    };
  } catch (error) {
    log(`F8 reporter (${model}): ${errorMessage(error)}`);
    return {
      gates: [{ id, kind: 'info' as const, name, threshold, verdict: 'FAIL' as Verdict, summary: errorMessage(error) }],
      details: { [key]: { model, sentPrompt: prompt, error: errorMessage(error) } },
    };
  }
}

function runLocalFunction(call: FunctionCall): object {
  const args = call.args as { period?: string; type?: 'business' | 'personal' | 'all' };
  const period = args.period ?? '2026-10';
  if (call.name === 'get_spending_by_category') return spendingByCategory(period, args.type ?? 'all');
  if (call.name === 'get_business_personal_split') return businessPersonalSplit(period);
  return { error: `Unknown function ${call.name}` };
}

export async function runFunctionCallingCheck(ai: AI, log: Log, model: string = ADVISOR_MODEL, id = 'I2') {
  const question = 'How much did I spend on business software and subscriptions in October 2026?';
  const transcript: { step: string; content: unknown }[] = [{ step: 'user', content: question }];
  const name = `F9 function calling round trip (ONLY_IN_CLOUD), ${model}`;
  const threshold = 'Model calls a local function, then answers from the totals';
  const key = detailKey('functionCalling', id, 'I2');
  try {
    const chat = createAdvisor(ai, false, model).startChat();
    const first = await chat.sendMessage(question);
    const calls = first.response.functionCalls() ?? [];
    if (calls.length === 0) {
      const text = first.response.text();
      transcript.push({ step: 'model answered without a function call', content: text });
      log(`F9 (${model}): model answered without calling a function`);
      return { gates: [{ id, kind: 'info' as const, name, threshold, verdict: 'WARN' as Verdict, summary: 'Answered without calling a function.' }], details: { [key]: transcript } };
    }
    const responses: Part[] = calls.map((call) => {
      const result = runLocalFunction(call);
      transcript.push({ step: `model called ${call.name}`, content: call.args });
      transcript.push({ step: `device returned (sent to cloud)`, content: result });
      return { type: 'functionResponse', functionResponse: { id: call.id, name: call.name, response: result } };
    });
    const second = await chat.sendMessage(responses);
    const answer = second.response.text();
    transcript.push({ step: 'final answer', content: answer });
    log(`F9 (${model}): called ${calls.map((c) => c.name).join(', ')}, then answered`);
    return {
      gates: [{
        id, kind: 'info' as const, name, threshold, verdict: (answer.trim() ? 'PASS' : 'WARN') as Verdict,
        summary: `Called ${calls.map((c) => `${c.name}(${JSON.stringify(c.args)})`).join(', ')}; answer: "${answer.slice(0, 160)}"`,
      }],
      details: { [key]: transcript },
    };
  } catch (error) {
    log(`F9 (${model}): ${errorMessage(error)}`);
    transcript.push({ step: 'error', content: errorMessage(error) });
    return { gates: [{ id, kind: 'info' as const, name, threshold, verdict: 'FAIL' as Verdict, summary: errorMessage(error) }], details: { [key]: transcript } };
  }
}

export async function runSearchComboCheck(ai: AI, log: Log, model: string = ADVISOR_MODEL, id = 'I3') {
  const prompt = 'What is the IRS standard mileage rate for business driving in 2026? Also, how much did I spend on travel in October 2026?';
  const name = `Function calling + Google Search in one request, ${model}`;
  const threshold = 'Request accepted with both tools';
  const key = detailKey('searchCombo', id, 'I3');
  try {
    const result = await createAdvisor(ai, true, model).generateContent(prompt);
    const calls = result.response.functionCalls() ?? [];
    const grounded = Boolean(result.response.candidates?.[0]?.groundingMetadata);
    log(`Search combo (${model}): accepted; function calls=${calls.length}, grounding=${grounded}`);
    return {
      gates: [{ id, kind: 'info' as const, name, threshold, verdict: 'PASS' as Verdict, summary: `Accepted. Function calls: ${calls.map((c) => c.name).join(', ') || 'none'}; grounding metadata: ${grounded ? 'yes' : 'no'}.` }],
      details: { [key]: { model, prompt, functionCalls: calls, grounded } },
    };
  } catch (error) {
    const message = errorMessage(error);
    log(`Search combo (${model}): ${message}`);
    return {
      gates: [{
        id, kind: 'info' as const, name, threshold, verdict: 'FAIL' as Verdict,
        summary: isCapacityError(message) ? `${message} (model busy or over quota: the combination itself was not tested)` : `${message} (fallback: run Search in a separate instance)`,
      }],
      details: { [key]: { model, prompt, error: message } },
    };
  }
}

export async function runPreferOnDeviceCheck(ai: AI, log: Log) {
  const name = 'PREFER_ON_DEVICE reports inferenceSource';
  const status = await getDeviceStatus();
  try {
    const result = await createPreferOnDevice(ai).generateContent('Say hello in five words.');
    const source = result.response.inferenceSource;
    const expected = status === 'available' ? 'on_device' : 'in_cloud';
    log(`PREFER_ON_DEVICE: source ${source} (device ${status})`);
    return {
      gates: [{ id: 'I4', kind: 'info' as const, name, threshold: `Source is "${expected}" when the device is ${status}`, verdict: (source === expected ? 'PASS' : 'WARN') as Verdict, summary: `inferenceSource = ${source}; device status = ${status}.` }],
      details: { preferOnDevice: { source, deviceStatus: status } },
    };
  } catch (error) {
    return { gates: [{ id: 'I4', kind: 'info' as const, name, threshold: '', verdict: 'FAIL' as Verdict, summary: errorMessage(error) }], details: {} };
  }
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export function decide(gates: Gate[]): string[] {
  const byId = new Map(gates.map((g) => [g.id, g]));
  const v = (id: string) => byId.get(id)?.verdict;
  const lines: string[] = [];

  const core = ['G1', 'G2', 'G3', 'G4'];
  if (core.some((id) => v(id) === undefined)) {
    lines.push('On-device tests have not run yet.');
  } else if (v('G1') === 'FAIL') {
    lines.push('NOT TESTED: the on-device model is not available in this browser. Enable it in Chrome (README) and run again.');
  } else if (['G1', 'G2', 'G4'].some((id) => v(id) === 'FAIL' || v(id) === 'SKIP')) {
    lines.push('NO-GO for on-device labeling: output or accuracy failed. Fix that before building.');
  } else if (v('G3') === 'FAIL') {
    const speed = v('S9');
    if (speed === undefined) lines.push('Quality is fine but the baseline is slow (G3). Run the speed comparison (button 4).');
    else if (speed === 'PASS') lines.push('GO with a design change: use the fastest usable variant (S9) instead of the baseline schema.');
    else if (speed === 'WARN') lines.push('GO with a design change: no variant meets the time target, but streaming shows the first row quickly. Show rows as they arrive.');
    else lines.push('NO-GO on speed: no variant is both usable and fast enough.');
  } else if (core.some((id) => v(id) === 'WARN')) {
    lines.push('GO with caution for on-device labeling. Check the WARN rows before building.');
  } else {
    lines.push('GO for on-device labeling (F3).');
  }

  if (v('G5') === 'FAIL' || v('G5') === 'WARN') lines.push('F7: replace with F7-alt ("Business purpose note").');
  else if (v('G5') === 'PASS') lines.push('F7: keep "Explain this charge".');

  if (v('G6') === 'FAIL') lines.push('F9a: guard misses messages or blocks too much. Fix before relying on it.');
  else if (v('G6') === 'WARN') lines.push('F9a: only the rule layer was tested. Re-run with the on-device model.');
  else if (v('G6') === 'PASS') lines.push('F9a: keep both guard layers.');

  const summary = (id: string) => byId.get(id)?.summary;
  const capacity = (id: string) => v(id) === 'FAIL' && isCapacityError(summary(id));

  if (v('G7') === undefined) lines.push('Cloud: not tested yet (needs .env.local).');
  else if (v('G7') === 'FAIL' && !isCapacityError(summary('G7'))) lines.push('Cloud: no model answered. Fix the Firebase setup before cloud features.');
  else if (v('G7') !== 'PASS' && isCapacityError(summary('G7'))) lines.push('Cloud: the Firebase setup works, but some models were busy or over quota (500/429). Retry later, or use a model that answered.');
  else if (v('G7') === 'WARN') lines.push('Cloud: some models failed. Swap those names in Remote Config.');
  else lines.push('Cloud: all PRD models answer.');

  // Each feature is checked on the PRD model and on the fallback model.
  const features: [string, string, string][] = [
    ['F8 structured output', 'I1', 'I5'],
    ['F9 function calling', 'I2', 'I6'],
    ['F9 function calling + Search', 'I3', 'I7'],
  ];
  for (const [feature, prdId, fallbackId] of features) {
    const prd = v(prdId);
    const fallback = v(fallbackId);
    if (prd === undefined && fallback === undefined) continue;
    if (prd === 'PASS') lines.push(`${feature}: works on the PRD model (${prdId}).`);
    else if (fallback === 'PASS') lines.push(`${feature}: works on the fallback model (${fallbackId}) only${capacity(prdId) ? '; the PRD model was busy or over quota' : ''}.`);
    else if (capacity(prdId) && (fallback === undefined || capacity(fallbackId))) lines.push(`${feature}: not tested, models were busy or over quota. Retry later.`);
    else if (prdId === 'I3') lines.push('Search grounding: cannot share a request with function calling on the models that answered. Use a separate instance, or drop Search.');
    else if (capacity(prdId)) lines.push(`${feature}: ${fallback === 'WARN' ? 'weak' : 'failed'} on the fallback model (${fallbackId}); the PRD model was busy or over quota. Check the details.`);
    else lines.push(`${feature}: did not pass on any model tried. Check the details before building it.`);
  }
  return lines;
}
