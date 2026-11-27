// "What is this merchant?" on a review card. Gemini Nano answers on this device
// when it can. If it cannot, nothing is sent until the user agrees, and then
// only the merchant name goes to the cloud.

import { CircleHelp, Cloud, Cpu, LoaderCircle } from 'lucide-react';
import type { Transaction } from '../lib/data/db';
import { explainMerchant, explainStore } from '../lib/ai/explainer';
import { useStore } from '../lib/util/store';
import { Badge, Button } from './ui';

export function ExplainMerchant({ tx }: { tx: Transaction }) {
  const state = useStore(explainStore)[tx.merchantKey];
  const ask = (allowCloud = false) => void explainMerchant(tx.merchantKey, tx.cleanMerchant, tx.isDemo, { allowCloud });
  const clear = () => explainStore.set({ [tx.merchantKey]: undefined });

  if (!state) {
    return (
      <button
        type="button"
        onClick={() => ask()}
        className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line bg-sunken px-2.5 text-xs font-medium text-fg-secondary transition-colors hover:border-line-strong hover:bg-subtle hover:text-fg"
      >
        <CircleHelp aria-hidden className="size-3.5 text-zinc-400" /> What is this merchant?
      </button>
    );
  }

  if (state.status === 'loading') {
    return (
      <p
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-xs font-medium text-fg-secondary"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        {state.where === 'device' ? 'Asking Laptop AI…' : 'Asking Cloud AI…'}
      </p>
    );
  }

  if (state.status === 'needs-consent') {
    return (
      <div className="mt-3 rounded-lg border border-cloud-line bg-cloud-soft p-3.5 text-xs">
        <p className="leading-relaxed text-fg-secondary">
          Laptop AI isn&apos;t available here, so this question would go to Cloud AI. Only the name{' '}
          <span className="font-semibold text-fg">&ldquo;{tx.cleanMerchant}&rdquo;</span> is sent. No amount, date, or bank
          description.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-8 px-2.5 text-xs" onClick={() => ask(true)} disabled={!state.cloudPossible}>
            <Cloud aria-hidden className="size-3.5 text-cloud-fg" /> Send the name to Cloud AI
          </Button>
          <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={clear}>
            Not now
          </Button>
          {!state.cloudPossible && <span className="text-xs text-fg-muted">Needs an internet connection and Cloud AI set up for this app.</span>}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-review-line bg-review-soft px-3 py-2 text-xs text-review-ink"
      >
        {state.message}
        <button type="button" onClick={clear} className="ml-auto font-medium underline">
          Dismiss
        </button>
      </p>
    );
  }

  const { result } = state;
  const local = result.source === 'on_device';
  return (
    <div
      className="mt-3 rounded-lg border border-line bg-sunken p-3.5 text-sm"
      aria-live="polite"
    >
      <p className="text-[13px] leading-relaxed text-fg-secondary">
        {result.known ? result.text : "Not recognized. The AI doesn't know this merchant, so it didn't guess."}
      </p>
      <div className="mt-2">
        <Badge tone={local ? 'device' : 'cloud'}>
          {local ? <Cpu aria-hidden className="size-3" /> : <Cloud aria-hidden className="size-3" />}
          {local ? 'Laptop AI · the name stayed on your laptop' : 'Cloud AI · merchant name only, with your OK'}
        </Badge>
      </div>
    </div>
  );
}
