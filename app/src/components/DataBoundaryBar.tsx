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
      aria-label="Privacy summary. Open the Privacy Ledger."
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-xs transition-colors hover:border-line-strong lg:hidden"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
        <ShieldCheck aria-hidden className="size-3.5 text-device-fg" />
        Privacy
      </span>
      <span className="inline-flex items-center gap-1.5 font-medium text-fg-secondary tabular-nums">
        <Laptop aria-hidden className="size-3.5 text-device-fg" /> {rows.toLocaleString('en-US')} on laptop
      </span>
      <span
        className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
          nothingSent ? 'text-device-fg' : 'text-cloud-fg'
        }`}
      >
        <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} sent
      </span>
      {counters.blockedMessages > 0 && (
        <span className="inline-flex items-center gap-1.5 font-medium text-danger-fg tabular-nums">
          <Ban aria-hidden className="size-3.5" /> {counters.blockedMessages} stopped
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1 font-medium text-fg-muted">
        Ledger <ArrowRight aria-hidden className="size-3.5" />
      </span>
    </a>
  );
}
