// "What is this merchant?" (PREFER_ON_DEVICE). Only the cleaned merchant name
// is used: no amount, date, or raw bank description. Gemini Nano answers when
// it is available. Without it the SDK would route to the cloud, so the app asks
// first, and a name that does leave is counted under "Merchant names shared".

import { errorText, friendlyCloudError } from './cloudCall';
import { cloudReady } from './firebase';
import { FEATURE, recordLedger } from './ledger';
import { CLOUD_MODEL, getExplainerModel, ON_DEVICE_MODEL } from './models';
import { getDeviceStatus } from './onDevice';
import { createStore } from './store';
import { CLOUD_TIMEOUT_MS, withTimeout } from './withTimeout';

export interface Explanation {
  known: boolean;
  text: string;
  source: 'on_device' | 'in_cloud';
}

export type ExplainState =
  | { status: 'loading'; where: 'device' | 'cloud' }
  /** No on-device model: the user decides whether the name may go to the cloud. */
  | { status: 'needs-consent'; cloudPossible: boolean }
  | { status: 'done'; result: Explanation }
  | { status: 'error'; message: string };

/** One entry per merchant, so asking again costs no inference and survives navigation. */
export const explainStore = createStore<Record<string, ExplainState>>({});

/** On-device generation has no network timeout of its own. */
const ON_DEVICE_TIMEOUT_MS = 30_000;

export function explainPrompt(merchantName: string): string {
  return `Merchant name on a bank statement: "${merchantName}"`;
}

export function resetExplanations(): void {
  for (const key of Object.keys(explainStore.get())) explainStore.set({ [key]: undefined });
}

export async function explainMerchant(merchantKey: string, merchantName: string, isDemo: boolean, options: { allowCloud?: boolean } = {}): Promise<void> {
  const current = explainStore.get()[merchantKey];
  if (current?.status === 'loading' || current?.status === 'done') return;

  const onDevice = (await getDeviceStatus()) === 'available';
  if (!onDevice && !options.allowCloud) {
    explainStore.set({ [merchantKey]: { status: 'needs-consent', cloudPossible: cloudReady && navigator.onLine } });
    return;
  }

  explainStore.set({ [merchantKey]: { status: 'loading', where: onDevice ? 'device' : 'cloud' } });
  const prompt = explainPrompt(merchantName);
  const bytes = new TextEncoder().encode(prompt).length;
  const base = { feature: FEATURE.explain, mode: 'PREFER_ON_DEVICE', rawRowCount: 0, isDemo };
  const start = performance.now();

  try {
    const result = await withTimeout(
      getExplainerModel().generateContent(prompt, { timeout: CLOUD_TIMEOUT_MS }),
      onDevice ? ON_DEVICE_TIMEOUT_MS : CLOUD_TIMEOUT_MS + 2_000,
      'The model',
    );
    // Logged from what the SDK reports, not from what was expected.
    const source = result.response.inferenceSource === 'in_cloud' ? 'in_cloud' : 'on_device';
    const durationMs = Math.round(performance.now() - start);
    if (source === 'on_device') {
      await recordLedger({
        ...base,
        inferenceSource: 'on_device',
        model: ON_DEVICE_MODEL,
        payloadPreview: `Merchant name "${merchantName}" explained in this browser. Nothing was sent.`,
        bytes,
        merchantNameCount: 0,
        consent: false,
        durationMs,
      });
    } else {
      await recordLedger({ ...base, inferenceSource: 'in_cloud', model: CLOUD_MODEL, payloadPreview: prompt, bytes, merchantNameCount: 1, consent: Boolean(options.allowCloud), durationMs });
    }

    let parsed: { known?: unknown; explanation?: unknown } = {};
    try {
      parsed = JSON.parse(result.response.text()) as typeof parsed;
    } catch {
      // Treated as "not recognized" below.
    }
    const text = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : '';
    explainStore.set({ [merchantKey]: { status: 'done', result: { known: parsed.known === true && text.length > 0, text, source } } });
  } catch (error) {
    // The cloud path is only taken when no on-device model was available.
    if (!onDevice) {
      await recordLedger({
        ...base,
        inferenceSource: 'in_cloud',
        model: CLOUD_MODEL,
        payloadPreview: prompt,
        bytes,
        merchantNameCount: 1,
        consent: Boolean(options.allowCloud),
        durationMs: Math.round(performance.now() - start),
        error: errorText(error),
      });
    }
    explainStore.set({ [merchantKey]: { status: 'error', message: onDevice ? `The on-device model could not answer. ${errorText(error)}` : friendlyCloudError(error) } });
  }
}
