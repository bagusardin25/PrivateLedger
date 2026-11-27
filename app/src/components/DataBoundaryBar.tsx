// On narrow screens the Data Boundary panel sits below the work area, so this
// one-line version stays on top: what is kept here, and what was sent.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Ban, Cloud, Laptop } from 'lucide-react';
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
      className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-2.5 text-sm shadow-sm ring-1 ring-slate-900/5 lg:hidden"
    >
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 tabular-nums">
        <Laptop aria-hidden className="size-4" /> {rows.toLocaleString('en-US')} kept here
      </span>
      <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${nothingSent ? 'text-emerald-800' : 'text-sky-800'}`}>
        <Cloud aria-hidden className="size-4" /> {counters.rawSentUser} raw sent
      </span>
      {counters.blockedMessages > 0 && (
        <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 tabular-nums">
          <Ban aria-hidden className="size-4" /> {counters.blockedMessages} blocked
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-sky-800">
        Ledger <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </a>
  );
}
