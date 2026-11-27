// Review mode: one decision at a time instead of a spreadsheet. Each answer
// is saved as merchant memory, so the same merchant never needs asking again.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Briefcase,
  CircleAlert,
  CircleCheck,
  Cpu,
  History,
  House,
  SkipForward,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ExplainMerchant } from '../components/ExplainMerchant';
import { Badge, Button, Card, Kbd, ProgressBar } from '../components/ui';
import { navigate, setCategoryByUser, setTypeByUser } from '../lib/state/actions';
import { db, type Transaction } from '../lib/data/db';
import { formatMoney, formatShortDate, plural } from '../lib/util/format';
import { CATEGORIES, type Category } from '../lib/core/taxonomy';

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

  if (all === undefined) {
    return (
      <Card className="mx-auto max-w-2xl space-y-4 py-10">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 w-full rounded-xl" />
      </Card>
    );
  }

  const remaining = queue.length;
  const totalThisSession = decided + remaining;
  const percent = totalThisSession ? Math.round((decided / totalThisSession) * 100) : 100;

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card className="relative overflow-hidden px-6 py-14 text-center">
          {remaining === 0 ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-50/80 to-transparent"
              />
              <div className="relative flex flex-col items-center">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.45)] ring-4 ring-emerald-50">
                  <CircleCheck aria-hidden className="size-8" />
                </span>
                <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">{decided > 0 ? 'All sorted' : 'Nothing to review'}</h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                  {decided > 0
                    ? `You made ${plural(decided, 'decision')}. Each one is saved to local merchant memory for future statements.`
                    : 'Every labeled transaction already has a business or personal label.'}
                </p>
                {waiting > 0 && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700">
                    <Cpu aria-hidden className="size-3.5 text-slate-500" /> {plural(waiting, 'transaction')} still wait for on-device AI.
                  </p>
                )}
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button variant="primary" className="min-h-11 px-5" onClick={() => navigate('summary')}>
                    See summary &amp; export <ArrowRight aria-hidden className="size-4" />
                  </Button>
                  <Button className="min-h-11" onClick={() => navigate('transactions')}>
                    Back to transactions
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                <Undo2 aria-hidden className="size-6" />
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">You skipped {plural(skipped.length, 'transaction')}</h1>
              <p className="mt-2 text-sm text-slate-600">They are still waiting for your business or personal decision.</p>
              <Button variant="primary" className="mt-6" onClick={() => setSkipped([])}>
                <Undo2 aria-hidden className="size-4" /> Go through them again
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Review</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            <span className="font-semibold text-amber-800 tabular-nums">{plural(remaining, 'decision')} left</span>
            {decided > 0 && <span className="tabular-nums"> · {decided} done this session</span>}
          </p>
        </div>
        <Button variant="ghost" className="min-h-9 rounded-xl px-3 text-xs" onClick={() => navigate('transactions')}>
          See all in table
        </Button>
      </div>

      <ProgressBar value={percent} label="Review progress" tone="device" />

      {/* Stacked triage deck */}
      <div className="relative pt-1 pb-2">
        {remaining > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-6 rounded-b-2xl border border-slate-200/60 bg-white/55"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 bottom-1 h-6 rounded-b-2xl border border-slate-200/80 bg-white/80 shadow-xs"
          />
        )}
        <ReviewCard key={current.id} tx={current} sameMerchant={sameMerchant} busy={busy} onDecide={(t) => void decide(t)} onSkip={skip} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>B</Kbd> Business
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>P</Kbd> Personal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>S</Kbd> Skip
        </span>
      </div>

      <p aria-live="polite" className="min-h-6 text-center text-sm text-slate-600">
        {last && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/90 px-3 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-200/80">
            <Sparkles aria-hidden className="size-3.5 shrink-0 text-emerald-700" />
            <span>
              <strong className="font-semibold">{last.merchant}</strong> marked {last.type}
              {last.applied > 1 ? ` · applied to ${last.applied} transactions` : ''}.
            </span>
          </span>
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
    <article
      aria-label={`Decide: ${tx.cleanMerchant}`}
      className="card-in relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.05),0_20px_40px_-14px_rgba(15,23,42,0.12)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/75 px-6 py-3 sm:px-8">
        <time dateTime={tx.date} className="text-xs font-semibold text-slate-500 tabular-nums">
          {formatShortDate(tx.date)}
        </time>
        <Badge tone={sameMerchant > 1 ? 'ink' : 'neutral'}>
          <History aria-hidden className="size-3" />
          {sameMerchant > 1 ? `Applies to ${sameMerchant} rows` : 'Saves to merchant memory'}
        </Badge>
      </div>

      <div className="px-6 pt-6 pb-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">{tx.cleanMerchant}</h2>
            <p className="mt-1 truncate font-mono text-xs text-slate-500" title={tx.rawDescription}>
              {tx.rawDescription}
            </p>
          </div>
          <p className={`text-3xl font-bold tracking-tight tabular-nums ${moneyIn ? 'text-emerald-700' : 'text-slate-950'}`}>
            {moneyIn ? '+' : ''}
            {formatMoney(tx.amount)}
          </p>
        </div>

        <ExplainMerchant tx={tx} />

        {tx.reviewReason && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50/85 px-3.5 py-3 text-sm text-amber-950 ring-1 ring-amber-200/80">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>{tx.reviewReason}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor={`cat-${tx.id}`} className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
            Category
          </label>
          <select
            id={`cat-${tx.id}`}
            value={tx.category ?? 'Other'}
            onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
            className="min-h-9 rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm font-medium text-slate-900 transition-colors hover:border-slate-300 hover:bg-white focus:border-ink-700 focus:bg-white focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-8">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('business')}
          className="group flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-ink-700 to-ink-800 px-4 text-base font-semibold text-white shadow-[0_2px_8px_-2px_rgba(23,50,86,0.45),inset_0_1px_0_rgba(255,255,255,0.16)] transition-all duration-150 hover:-translate-y-0.5 hover:from-ink-600 hover:to-ink-700 active:translate-y-0 active:scale-[0.985] disabled:opacity-60"
        >
          <Briefcase aria-hidden className="size-5" />
          Business
          <kbd className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-white/95 ring-1 ring-white/20">
            B
          </kbd>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('personal')}
          className="group flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-white px-4 text-base font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90 transition-all duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md hover:ring-slate-300 active:translate-y-0 active:scale-[0.985] disabled:opacity-60"
        >
          <House aria-hidden className="size-5 text-slate-600" />
          Personal
          <Kbd className="ml-1">P</Kbd>
        </button>

        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {sameMerchant > 1
              ? `Your answer also applies to ${sameMerchant - 1} other ${tx.cleanMerchant} transaction${sameMerchant > 2 ? 's' : ''}.`
              : 'Your answer is remembered locally for this merchant.'}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
          >
            <SkipForward aria-hidden className="size-3.5" /> Skip
          </button>
        </div>
      </div>
    </article>
  );
}
