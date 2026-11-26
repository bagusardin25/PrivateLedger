// Review mode: one decision at a time instead of a spreadsheet. Each answer
// is saved as merchant memory, so the same merchant never needs asking again.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Briefcase, CircleAlert, CircleCheck, Cpu, House, SkipForward, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ExplainMerchant } from '../components/ExplainMerchant';
import { Button, Card, ProgressBar } from '../components/ui';
import { navigate, setCategoryByUser, setTypeByUser } from '../lib/actions';
import { db, type Transaction } from '../lib/db';
import { formatMoney, formatShortDate, plural } from '../lib/format';
import { CATEGORIES, type Category } from '../lib/taxonomy';

interface Decision {
  merchant: string;
  type: 'business' | 'personal';
  applied: number;
}

export function ReviewView() {
  const all = useLiveQuery(() => db.transactions.toArray(), []);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [decided, setDecided] = useState(0);
  const [last, setLast] = useState<Decision>();
  const [busy, setBusy] = useState(false);

  const queue = (all ?? []).filter((t) => t.needsReview).sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row);
  const current = queue.find((t) => !skipped.includes(t.id)) ?? undefined;
  const waiting = (all ?? []).filter((t) => t.source === 'pending').length;
  const sameMerchant = current ? (all ?? []).filter((t) => t.merchantKey === current.merchantKey).length : 0;

  const decide = useCallback(
    async (type: 'business' | 'personal') => {
      if (!current || busy) return;
      setBusy(true);
      await setTypeByUser(current.id, type);
      setLast({ merchant: current.cleanMerchant, type, applied: sameMerchant });
      setDecided((n) => n + 1);
      setBusy(false);
    },
    [current, busy, sameMerchant],
  );

  const skip = useCallback(() => {
    if (current) setSkipped((ids) => [...ids, current.id]);
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (key === 'b') void decide('business');
      else if (key === 'p') void decide('personal');
      else if (key === 's') skip();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, skip]);

  if (all === undefined) return <Card>Loading…</Card>;

  const remaining = queue.length;
  const totalThisSession = decided + remaining;
  const percent = totalThisSession ? Math.round((decided / totalThisSession) * 100) : 100;

  if (!current) {
    return (
      <div className="space-y-4">
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          {remaining === 0 ? (
            <>
              <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CircleCheck aria-hidden className="size-7" />
              </span>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight">{decided > 0 ? 'All sorted' : 'Nothing to review'}</h1>
              <p className="mt-2 max-w-md text-slate-700">
                {decided > 0 ? `You made ${plural(decided, 'decision')}. Each one is remembered for that merchant.` : 'Every labeled transaction already has business or personal.'}
              </p>
              {waiting > 0 && (
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <Cpu aria-hidden className="size-4 text-slate-600" /> {plural(waiting, 'transaction')} still wait for on-device AI.
                </p>
              )}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="primary" onClick={() => navigate('summary')}>
                  See summary &amp; export <ArrowRight aria-hidden className="size-4" />
                </Button>
                <Button onClick={() => navigate('transactions')}>Back to transactions</Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">You skipped {plural(skipped.length, 'transaction')}</h1>
              <p className="mt-2 text-slate-700">They are still waiting for a decision.</p>
              <Button variant="primary" className="mt-6" onClick={() => setSkipped([])}>
                <Undo2 aria-hidden className="size-4" /> Go through them again
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="text-sm text-slate-600">
            {plural(remaining, 'decision')} left{decided > 0 && ` · ${decided} done`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('transactions')}>
          See all in table
        </Button>
      </div>
      <ProgressBar value={percent} label="Review progress" />

      <ReviewCard key={current.id} tx={current} sameMerchant={sameMerchant} busy={busy} onDecide={(t) => void decide(t)} onSkip={skip} />

      <p className="text-center text-xs text-slate-600">
        Keyboard: <Kbd>B</Kbd> business · <Kbd>P</Kbd> personal · <Kbd>S</Kbd> skip
      </p>

      <p aria-live="polite" className="min-h-5 text-center text-sm text-slate-700">
        {last && (
          <>
            <span className="font-medium">{last.merchant}</span> marked {last.type}
            {last.applied > 1 ? `, applied to ${last.applied} transactions` : ''}.
          </>
        )}
      </p>
    </div>
  );
}

function ReviewCard({
  tx,
  sameMerchant,
  busy,
  onDecide,
  onSkip,
}: {
  tx: Transaction;
  sameMerchant: number;
  busy: boolean;
  onDecide: (type: 'business' | 'personal') => void;
  onSkip: () => void;
}) {
  const moneyIn = tx.amount > 0;
  return (
    <article aria-label={`Decide: ${tx.cleanMerchant}`} className="card-in overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-900/5">
      <div className="px-6 pt-6 pb-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-600">{formatShortDate(tx.date)}</p>
            <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">{tx.cleanMerchant}</h2>
            <p className="mt-1 truncate font-mono text-xs text-slate-600" title={tx.rawDescription}>
              {tx.rawDescription}
            </p>
          </div>
          <p className={`text-3xl font-semibold tracking-tight tabular-nums ${moneyIn ? 'text-emerald-800' : 'text-slate-900'}`}>
            {moneyIn ? '+' : ''}
            {formatMoney(tx.amount)}
          </p>
        </div>

        <ExplainMerchant tx={tx} />

        {tx.reviewReason && (
          <p className="mt-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {tx.reviewReason}
          </p>
        )}

        <label className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-700">
          Category
          <select
            value={tx.category ?? 'Other'}
            onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
            className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-ink-800"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-5 sm:px-8">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('business')}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-ink-800 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-ink-700 active:scale-[0.98] disabled:opacity-60"
        >
          <Briefcase aria-hidden className="size-5" /> Business
          <kbd className="ml-1 rounded bg-white/15 px-1.5 font-mono text-xs">B</kbd>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('personal')}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-4 text-base font-semibold text-slate-900 shadow-sm ring-1 ring-slate-300 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-60"
        >
          <House aria-hidden className="size-5" /> Personal
          <kbd className="ml-1 rounded bg-slate-100 px-1.5 font-mono text-xs text-slate-700">P</kbd>
        </button>
        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>{sameMerchant > 1 ? `Your answer also applies to ${sameMerchant - 1} other ${tx.cleanMerchant} transaction${sameMerchant > 2 ? 's' : ''}.` : 'Your answer is remembered for this merchant.'}</span>
          <button type="button" onClick={onSkip} className="inline-flex min-h-8 items-center gap-1 rounded px-2 font-medium text-slate-700 hover:bg-slate-200/70">
            <SkipForward aria-hidden className="size-3.5" /> Skip
          </button>
        </div>
      </div>
    </article>
  );
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[11px] text-slate-800">{children}</kbd>;
}
