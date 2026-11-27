// On narrow screens the Data Boundary panel sits below the work area, so this
// one-line version stays on top: what is kept here, and what was sent.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Ban, Cloud, Laptop, ShieldCheck } from 'lucide-react';
import { db } from '../lib/data/db';
import { countLedger } from '../lib/data/ledger';

export function DataBoundaryBar() {
  const rows = useLiveQuery(() => db.transactions.count(), [], 0);
  const entries = useLiveQuery(() => db.ledgerEntries.toArray(), [], []);
  const counters = countLedger(entries);
  const nothingSent = counters.rawSentUser === 0;

  return (
    <a
      href="#/ledger"
      aria-label="Data boundary summary. Open the Privacy Ledger."
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-stone-200/85 bg-white px-4 py-2.5 text-xs shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition-colors hover:border-stone-300 lg:hidden dark:border-white/[0.08] dark:bg-[#12131c] dark:hover:border-white/15"
    >
      <span className="inline-flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-100">
        <ShieldCheck aria-hidden className="size-4 text-teal-700 dark:text-teal-400" />
        Boundary
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-0.5 font-semibold text-teal-900 tabular-nums ring-1 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60">
        <Laptop aria-hidden className="size-3.5" /> {rows.toLocaleString('en-US')} local
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold tabular-nums ring-1 ${
          nothingSent
            ? 'bg-teal-50 text-teal-900 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60'
            : 'bg-indigo-50 text-indigo-900 ring-indigo-200/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-700/60'
        }`}
      >
        <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
      </span>
      {counters.blockedMessages > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-800 tabular-nums ring-1 ring-rose-200/80 dark:bg-rose-950/70 dark:text-rose-300 dark:ring-rose-700/60">
          <Ban aria-hidden className="size-3.5" /> {counters.blockedMessages} blocked
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-ink-700 dark:text-indigo-300">
        Ledger <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </a>
  );
}
