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
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 lg:hidden"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
        <ShieldCheck aria-hidden className="size-4 text-emerald-700" />
        Boundary
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800 tabular-nums ring-1 ring-emerald-200/80">
        <Laptop aria-hidden className="size-3.5" /> {rows.toLocaleString('en-US')} local
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold tabular-nums ring-1 ${
          nothingSent ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80' : 'bg-sky-50 text-sky-800 ring-sky-200/80'
        }`}
      >
        <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
      </span>
      {counters.blockedMessages > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700 tabular-nums ring-1 ring-rose-200/80">
          <Ban aria-hidden className="size-3.5" /> {counters.blockedMessages} blocked
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-ink-700">
        Ledger <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </a>
  );
}
