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
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-zinc-200/80 bg-white px-4 py-2.5 text-xs transition-colors hover:border-zinc-300 lg:hidden dark:border-white/[0.08] dark:bg-[#111114] dark:hover:border-white/[0.15]"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
        <ShieldCheck aria-hidden className="size-3.5 text-emerald-700 dark:text-emerald-400" />
        Boundary
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium text-zinc-600 tabular-nums dark:text-zinc-300">
        <Laptop aria-hidden className="size-3.5 text-emerald-700 dark:text-emerald-400" /> {rows.toLocaleString('en-US')} local
      </span>
      <span
        className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
          nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
        }`}
      >
        <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
      </span>
      {counters.blockedMessages > 0 && (
        <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 tabular-nums dark:text-rose-400">
          <Ban aria-hidden className="size-3.5" /> {counters.blockedMessages} blocked
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 font-medium text-zinc-500 dark:text-zinc-400">
        Ledger <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </a>
  );
}
