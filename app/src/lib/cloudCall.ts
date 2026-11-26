// One place for everything a cloud request needs: a hard timeout, retries with
// exponential backoff when the model is busy, a Privacy Ledger entry for every
// attempt, and error messages a person can act on.

import { AIError } from 'firebase/ai';
import type { LedgerEntry } from './db';
import { recordLedger } from './ledger';
import { CLOUD_MODEL } from './models';
import { createStore } from './store';
import { CLOUD_TIMEOUT_MS, TimeoutError, withTimeout } from './withTimeout';

const MAX_ATTEMPTS = 3;
/** Wait before attempt 2 and attempt 3; a little jitter is added to each. */
const BACKOFF_MS = [1_200, 3_500];
/** 429 quota, 500 "high demand", 503 overloaded: worth another try. */
const RETRY_STATUS = new Set([429, 500, 503]);

/** Lets the UI say "busy, trying again" instead of looking stuck. */
export const cloudRetryStore = createStore<{ retrying: boolean }>({ retrying: false });

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function httpStatus(error: unknown): number | undefined {
  if (error instanceof AIError && error.customErrorData?.status) return error.customErrorData.status;
  const match = error instanceof Error ? /\[(\d{3})\b/.exec(error.message) : null;
  return match ? Number(match[1]) : undefined;
}

export function isRetryable(error: unknown): boolean {
  const status = httpStatus(error);
  return status !== undefined && RETRY_STATUS.has(status);
}

export function backoffMs(attempt: number): number {
  return (BACKOFF_MS[attempt - 1] ?? BACKOFF_MS.at(-1)!) + Math.round(Math.random() * 400);
}

/** The SDK prefixes errors with the full request URL; the ledger keeps the part that says what happened. */
export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^.*?Error fetching from \S+:\s*/, '').trim() || message;
}

export function friendlyCloudError(error: unknown, subject = 'The cloud model'): string {
  const status = httpStatus(error);
  const message = errorText(error);
  if (error instanceof TimeoutError || /timeout|timed out|abort/i.test(message)) {
    return `${subject} did not answer in time. Your data is unchanged; try again in a moment.`;
  }
  if (status === 429 || /quota|resource.?exhausted/i.test(message)) return 'The free cloud quota is used up for now. Try again in a minute.';
  if (status === 500 || status === 503 || /overloaded|high demand/i.test(message)) return `${subject} is busy right now. Try again in a moment.`;
  if (status === 401 || status === 403 || /app.?check/i.test(message)) {
    return 'The request was rejected by App Check, so nothing was processed. Cloud features are not set up for this build.';
  }
  if (!navigator.onLine || /failed to fetch|network/i.test(message)) return 'No connection. Cloud features need to be online; labeling and review still work offline.';
  return `${subject} could not answer. ${message}`;
}

export type CloudLedgerMeta = Pick<LedgerEntry, 'feature' | 'mode' | 'payloadPreview' | 'bytes' | 'rawRowCount' | 'merchantNameCount' | 'consent' | 'isDemo'>;

/**
 * Runs one cloud call. Every attempt is a request that left this device, so
 * every attempt gets its own ledger entry, including the ones that failed.
 * `call` must pass `{ timeout: CLOUD_TIMEOUT_MS }` to the SDK so the HTTP request
 * is really aborted; the timer here is a backstop so the UI always gets an answer.
 */
export async function cloudRequest<T>(meta: CloudLedgerMeta, call: () => Promise<T>, subject: string): Promise<T> {
  try {
    for (let attempt = 1; ; attempt += 1) {
      const start = performance.now();
      const base = { ...meta, inferenceSource: 'in_cloud' as const, model: CLOUD_MODEL };
      try {
        const result = await withTimeout(call(), CLOUD_TIMEOUT_MS + 2_000, subject);
        await recordLedger({ ...base, durationMs: Math.round(performance.now() - start) });
        return result;
      } catch (error) {
        const retry = attempt < MAX_ATTEMPTS && isRetryable(error);
        await recordLedger({
          ...base,
          durationMs: Math.round(performance.now() - start),
          error: `${errorText(error)}${retry ? ' (trying again)' : ''}`,
        });
        if (!retry) throw error;
        cloudRetryStore.set({ retrying: true });
        await sleep(backoffMs(attempt));
      }
    }
  } finally {
    cloudRetryStore.set({ retrying: false });
  }
}
