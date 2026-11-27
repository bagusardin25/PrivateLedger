// Monthly summary: PREFER_IN_CLOUD. The cloud receives the payload below and
// nothing else: totals per category and per type for one month. When the cloud
// cannot answer (offline, over quota, overloaded), the SDK falls back to Gemini
// Nano, and the ledger records both what was attempted and where it was written.

import { backoffMs, cloudRetryStore, errorText, isRetryable } from './cloudCall';
import type { Transaction } from '../data/db';
import { FEATURE, recordLedger } from '../data/ledger';
import { LOCAL_FUNCTIONS } from './localFunctions';
import { CLOUD_MODEL, getReporterModel, ON_DEVICE_MODEL } from './models';
import { createStore } from '../util/store';
import { CLOUD_TIMEOUT_MS, withTimeout } from '../util/withTimeout';

export interface SummaryPayload {
  period: string;
  currency: 'USD';
  totals: object;
  business_spending_by_category: object;
  previous_period?: { period: string; totals: object };
}

export interface PeriodSummary {
  headline: string;
  highlights: string[];
  warnings: string[];
  source: 'in_cloud' | 'on_device';
  /** Why Gemini Nano wrote it, when it did. */
  fallback?: 'offline' | 'cloud-unavailable';
  ms: number;
}

/** Kept outside the view, so the summary is still there after visiting another screen. */
export const summaryStore = createStore<{ result?: PeriodSummary; busy: boolean; error?: string; sentFor?: string }>({ busy: false });

export function resetSummary(): void {
  summaryStore.set({ result: undefined, busy: false, error: undefined, sentFor: undefined });
}

const MAX_ATTEMPTS = 3;
/** The cloud gets CLOUD_TIMEOUT_MS; after that an on-device fallback still needs time to write. */
const ON_DEVICE_ALLOWANCE_MS = 60_000;

/** Built from the same local functions the advisor uses, so both send the same kind of data. */
export function buildSummaryPayload(rows: Transaction[]): SummaryPayload {
  const { months } = LOCAL_FUNCTIONS.get_available_periods(rows, {}) as { months: string[] };
  const period = months.at(-1) ?? 'all';
  const previous = months.length > 1 ? months.at(-2) : undefined;
  const totalsOf = (p: string) => {
    const { period: _ignored, currency: _c, ...rest } = LOCAL_FUNCTIONS.get_business_personal_split(rows, { period: p }) as Record<string, unknown>;
    return rest;
  };
  const categories = (LOCAL_FUNCTIONS.get_spending_by_category(rows, { period, type: 'business' }) as { totals: object }).totals;
  return {
    period,
    currency: 'USD',
    totals: totalsOf(period),
    business_spending_by_category: categories,
    ...(previous ? { previous_period: { period: previous, totals: totalsOf(previous) } } : {}),
  };
}

export function summaryPrompt(payload: SummaryPayload): string {
  return `Monthly totals (no individual transactions):\n${JSON.stringify(payload, null, 2)}`;
}

export async function writePeriodSummary(payload: SummaryPayload, isDemo: boolean): Promise<PeriodSummary> {
  const prompt = summaryPrompt(payload);
  const bytes = new TextEncoder().encode(prompt).length;
  const base = { feature: FEATURE.summary, mode: 'PREFER_IN_CLOUD', rawRowCount: 0, merchantNameCount: 0, consent: false, isDemo };
  const sent = { ...base, inferenceSource: 'in_cloud' as const, model: CLOUD_MODEL, payloadPreview: prompt, bytes };

  for (let attempt = 1; ; attempt += 1) {
    const start = performance.now();
    // PREFER_IN_CLOUD always tries the cloud first, so while online the totals were sent.
    const wasOnline = navigator.onLine;
    const elapsed = () => Math.round(performance.now() - start);

    let text: string;
    let source: PeriodSummary['source'];
    try {
      const result = await withTimeout(
        getReporterModel().generateContent(prompt, { timeout: CLOUD_TIMEOUT_MS }),
        CLOUD_TIMEOUT_MS + ON_DEVICE_ALLOWANCE_MS,
        'The summary model',
      );
      source = result.response.inferenceSource === 'on_device' ? 'on_device' : 'in_cloud';
      text = result.response.text();
    } catch (error) {
      const retry = wasOnline && attempt < MAX_ATTEMPTS && isRetryable(error);
      const reason = `${errorText(error)}${retry ? ' (trying again)' : ''}`;
      if (wasOnline) await recordLedger({ ...sent, durationMs: elapsed(), error: reason });
      else {
        await recordLedger({
          ...base,
          inferenceSource: 'refused',
          payloadPreview: 'Offline and no on-device model: nothing was sent.',
          bytes: 0,
          durationMs: elapsed(),
          error: reason,
        });
      }
      if (!retry) throw error;
      cloudRetryStore.set({ retrying: true });
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
      cloudRetryStore.set({ retrying: false });
      continue;
    }

    const ms = elapsed();
    if (source === 'in_cloud') {
      await recordLedger({ ...sent, durationMs: ms });
    } else {
      if (wasOnline) {
        await recordLedger({ ...sent, error: 'The cloud model did not answer; the SDK fell back to the on-device model.' });
      }
      await recordLedger({
        ...base,
        inferenceSource: 'on_device',
        model: ON_DEVICE_MODEL,
        payloadPreview: `Summary written in this browser from the same totals (${bytes} bytes).`,
        bytes,
        durationMs: ms,
      });
    }

    let parsed: Partial<PeriodSummary>;
    try {
      parsed = JSON.parse(text) as Partial<PeriodSummary>;
    } catch {
      throw new Error('The model returned a summary that could not be read. Try again.');
    }
    return {
      headline: String(parsed.headline ?? ''),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      source,
      fallback: source === 'on_device' ? (wasOnline ? 'cloud-unavailable' : 'offline') : undefined,
      ms,
    };
  }
}
