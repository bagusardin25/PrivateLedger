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
        className="mt-3.5 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-ink-50/90 px-3 text-xs font-semibold text-ink-800 ring-1 ring-ink-200/80 transition-colors hover:bg-ink-100/80 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/25 dark:hover:bg-indigo-500/20"
      >
        <CircleHelp aria-hidden className="size-3.5" /> What is this merchant?
      </button>
    );
  }

  if (state.status === 'loading') {
    return (
      <p
        className="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-stone-200/80 dark:bg-white/[0.05] dark:text-zinc-300 dark:ring-white/10"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        {state.where === 'device' ? 'Asking Gemini Nano on this device…' : 'Asking the cloud model…'}
      </p>
    );
  }

  if (state.status === 'needs-consent') {
    return (
      <div className="mt-3.5 rounded-xl bg-indigo-50/80 p-3.5 text-sm ring-1 ring-indigo-200/85 dark:bg-indigo-950/45 dark:ring-indigo-800/65">
        <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">
          On-device AI isn&apos;t available here, so this question would go to the cloud. Only the name{' '}
          <span className="font-semibold text-zinc-950 dark:text-white">&ldquo;{tx.cleanMerchant}&rdquo;</span> is sent: no amount, date, or bank
          description.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-8 rounded-lg px-3 text-xs" onClick={() => ask(true)} disabled={!state.cloudPossible}>
            <Cloud aria-hidden className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Send the name to the cloud
          </Button>
          <Button variant="ghost" className="min-h-8 rounded-lg px-3 text-xs" onClick={clear}>
            Not now
          </Button>
          {!state.cloudPossible && <span className="text-xs text-zinc-600 dark:text-zinc-400">Needs a connection and a configured Firebase project.</span>}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="mt-3.5 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800"
      >
        {state.message}
        <button type="button" onClick={clear} className="ml-auto rounded px-1.5 font-semibold underline">
          Dismiss
        </button>
      </p>
    );
  }

  const { result } = state;
  const local = result.source === 'on_device';
  return (
    <div
      className="mt-3.5 rounded-xl bg-stone-50/90 p-3.5 text-sm ring-1 ring-stone-200/90 dark:bg-white/[0.04] dark:ring-white/10"
      aria-live="polite"
    >
      <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">
        {result.known ? result.text : 'Not recognized. The model does not know this merchant, so it did not guess.'}
      </p>
      <div className="mt-2">
        <Badge tone={local ? 'device' : 'cloud'}>
          {local ? <Cpu aria-hidden className="size-3" /> : <Cloud aria-hidden className="size-3" />}
          {local ? 'On-device AI · the name stayed here' : 'Cloud · merchant name only, with your consent'}
        </Badge>
      </div>
    </div>
  );
}
