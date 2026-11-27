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
        className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-2.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100/70 hover:text-zinc-950 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.06] dark:hover:text-white"
      >
        <CircleHelp aria-hidden className="size-3.5 text-zinc-400" /> What is this merchant?
      </button>
    );
  }

  if (state.status === 'loading') {
    return (
      <p
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300"
        aria-live="polite"
      >
        <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        {state.where === 'device' ? 'Asking Gemini Nano on this device…' : 'Asking the cloud model…'}
      </p>
    );
  }

  if (state.status === 'needs-consent') {
    return (
      <div className="mt-3 rounded-lg border border-indigo-200/80 bg-indigo-50/50 p-3.5 text-xs dark:border-indigo-500/20 dark:bg-indigo-500/10">
        <p className="leading-relaxed text-zinc-700 dark:text-zinc-200">
          On-device AI isn&apos;t available here, so this question would go to the cloud. Only the name{' '}
          <span className="font-semibold text-zinc-950 dark:text-white">&ldquo;{tx.cleanMerchant}&rdquo;</span> is sent: no amount, date, or bank
          description.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-8 px-2.5 text-xs" onClick={() => ask(true)} disabled={!state.cloudPossible}>
            <Cloud aria-hidden className="size-3.5 text-indigo-600 dark:text-indigo-400" /> Send the name to the cloud
          </Button>
          <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={clear}>
            Not now
          </Button>
          {!state.cloudPossible && <span className="text-xs text-zinc-500 dark:text-zinc-400">Needs a connection and a configured Firebase project.</span>}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
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
      className="mt-3 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]"
      aria-live="polite"
    >
      <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">
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
