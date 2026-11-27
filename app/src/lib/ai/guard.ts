// Outgoing-message guard. Runs on this device before any chat message is sent:
// layer 1 rules always, layer 2 the on-device classifier when Gemini Nano is
// ready. A blocked message is never sent, and there is no "send anyway" button.

import { db } from '../data/db';
import { deterministicGuard, merchantPhrases, merchantTokens } from '../core/guardRules';
import { FEATURE, recordLedger } from '../data/ledger';
import { getGuardModel, ON_DEVICE_MODEL } from './models';
import { assertOnDeviceReady, getDeviceStatus } from './onDevice';
import { withTimeout } from '../util/withTimeout';

/** If Gemini Nano hangs, the rules still decide instead of leaving the chat stuck. */
const MODEL_TIMEOUT_MS = 15_000;

export interface GuardResult {
  allowed: boolean;
  reasons: string[];
  /** Which layers ran: rules always, the model only when Gemini Nano is ready. */
  layers: ('rules' | 'on-device model')[];
}

export async function checkOutgoingMessage(message: string): Promise<GuardResult> {
  const all = await db.transactions.toArray();
  const isDemo = all.length > 0 && all.every((t) => t.isDemo);
  const rules = deterministicGuard(
    message,
    merchantTokens(all.map((t) => t.rawDescription)),
    merchantPhrases(all.map((t) => t.merchantKey)),
  );
  const reasons = [...rules.reasons];
  const layers: GuardResult['layers'] = ['rules'];

  let modelBlock = false;
  let modelMs: number | undefined;
  if ((await getDeviceStatus()) === 'available') {
    try {
      await assertOnDeviceReady();
      const start = performance.now();
      const result = await withTimeout(getGuardModel().generateContent(`Message:\n"""\n${message}\n"""`), MODEL_TIMEOUT_MS, 'The privacy check');
      modelMs = Math.round(performance.now() - start);
      const verdict = (JSON.parse(result.response.text()) as { verdict?: unknown }).verdict;
      modelBlock = verdict === 'contains_transaction_data';
      layers.push('on-device model');
      if (modelBlock) reasons.push('Laptop AI found transaction details');
    } catch {
      // Layer 1 still decides when the model fails or times out.
    }
  }

  const allowed = !rules.block && !modelBlock;
  // The ledger lists AI calls and blocks. A rules-only check that lets a message
  // through is neither, so it is not logged as an "on-device AI call".
  if (allowed && !layers.includes('on-device model')) return { allowed, reasons, layers };
  await recordLedger({
    feature: FEATURE.guard,
    mode: 'ONLY_ON_DEVICE',
    inferenceSource: allowed ? 'on_device' : 'blocked',
    model: layers.includes('on-device model') ? ON_DEVICE_MODEL : 'Rules only',
    payloadPreview: allowed
      ? `Message checked on your laptop (${layers.join(' + ')}): no transaction details.`
      : `Not sent. The message was stopped on your laptop: ${reasons.join('; ')}.`,
    bytes: 0,
    rawRowCount: 0,
    merchantNameCount: 0,
    consent: false,
    isDemo,
    durationMs: modelMs,
  });
  return { allowed, reasons, layers };
}
