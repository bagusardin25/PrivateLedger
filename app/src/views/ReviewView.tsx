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
import { MerchantAvatar } from '../components/MerchantAvatar';
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
                className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-teal-50/85 to-transparent dark:from-teal-950/35"
              />
              <div className="relative flex flex-col items-center">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-800 shadow-[0_10px_28px_-6px_rgba(15,118,110,0.4)] ring-4 ring-teal-50 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-900/60">
                  <CircleCheck aria-hidden className="size-8" />
                </span>
                <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                  {decided > 0 ? 'All sorted' : 'Nothing to review'}
                </h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {decided > 0
                    ? `You made ${plural(decided, 'decision')}. Each one is saved to local merchant memory for future statements.`
                    : 'Every labeled transaction already has a business or personal label.'}
                </p>
                {waiting > 0 && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-100 px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                    <Cpu aria-hidden className="size-3.5 text-zinc-500" /> {plural(waiting, 'transaction')} still wait for on-device AI.
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
              <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800">
                <Undo2 aria-hidden className="size-6" />
              </span>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
                You skipped {plural(skipped.length, 'transaction')}
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">They are still waiting for your business or personal decision.</p>
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
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Review</h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-amber-800 tabular-nums dark:text-amber-300">{plural(remaining, 'decision')} left</span>
            {decided > 0 && <span className="tabular-nums"> · {decided} done this session</span>}
          </p>
        </div>
        <Button variant="ghost" className="min-h-9 rounded-xl px-3 text-xs" onClick={() => navigate('transactions')}>
          See all in table
        </Button>
      </div>

      <ProgressBar value={percent} label="Review progress" tone="device" />

      {/* Stacked triage deck with subtle spotlight */}
      <div className="relative pt-1 pb-2.5">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-tr from-indigo-200/20 via-transparent to-teal-200/20 blur-2xl dark:from-indigo-500/12 dark:to-teal-500/10"
        />
        {remaining > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-7 bottom-0 h-6 rounded-b-2xl border border-stone-200/60 bg-white/55 dark:border-white/[0.06] dark:bg-[#12131c]/50"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3.5 bottom-1.5 h-6 rounded-b-2xl border border-stone-200/85 bg-white/85 shadow-xs dark:border-white/[0.08] dark:bg-[#12131c]/80"
          />
        )}
        <ReviewCard key={current.id} tx={current} sameMerchant={sameMerchant} busy={busy} onDecide={(t) => void decide(t)} onSkip={skip} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
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

      <p aria-live="polite" className="min-h-6 text-center text-sm text-zinc-600 dark:text-zinc-300">
        {last && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50/90 px-3.5 py-1 text-xs font-medium text-teal-950 ring-1 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-200 dark:ring-teal-700/60">
            <Sparkles aria-hidden className="size-3.5 shrink-0 text-teal-700 dark:text-teal-400" />
            <span>
              <strong className="font-bold">{last.merchant}</strong> marked {last.type}
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
      className="card-in relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_6px_18px_rgba(24,24,27,0.06),0_24px_48px_-16px_rgba(28,31,74,0.14)] dark:border-white/[0.09] dark:bg-[#12131c] dark:shadow-[0_24px_54px_-16px_rgba(0,0,0,0.7)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 bg-stone-50/80 px-6 py-3 sm:px-8 dark:border-white/[0.07] dark:bg-white/[0.025]">
        <time dateTime={tx.date} className="text-xs font-semibold text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatShortDate(tx.date)}
        </time>
        <Badge tone={sameMerchant > 1 ? 'ink' : 'neutral'}>
          <History aria-hidden className="size-3" />
          {sameMerchant > 1 ? `Applies to ${sameMerchant} rows` : 'Saves to merchant memory'}
        </Badge>
      </div>

      <div className="px-6 pt-6 pb-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <MerchantAvatar name={tx.cleanMerchant} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">{tx.cleanMerchant}</h2>
              <p
                className="mt-1 inline-block max-w-full truncate rounded-md bg-stone-100/95 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300"
                title={tx.rawDescription}
              >
                {tx.rawDescription}
              </p>
            </div>
          </div>
          <p className={`text-3xl font-extrabold tracking-tight tabular-nums ${moneyIn ? 'text-teal-700 dark:text-teal-400' : 'text-zinc-950 dark:text-white'}`}>
            {moneyIn ? '+' : ''}
            {formatMoney(tx.amount)}
          </p>
        </div>

        <ExplainMerchant tx={tx} />

        {tx.reviewReason && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50/90 px-3.5 py-3 text-sm text-amber-950 ring-1 ring-amber-200/85 dark:bg-amber-950/45 dark:text-amber-200 dark:ring-amber-800/60">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>{tx.reviewReason}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor={`cat-${tx.id}`} className="text-xs font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
            Category
          </label>
          <select
            id={`cat-${tx.id}`}
            value={tx.category ?? 'Other'}
            onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
            className="min-h-9 rounded-xl border border-stone-200 bg-stone-50/75 px-3 text-sm font-semibold text-zinc-900 transition-colors hover:border-stone-300 hover:bg-white focus:border-ink-700 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-white/[0.05] dark:text-zinc-100 dark:hover:border-white/20 dark:focus:border-indigo-400"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-white text-zinc-900 dark:bg-[#12131c] dark:text-zinc-100">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-stone-100 bg-stone-50/80 px-6 py-5 sm:px-8 dark:border-white/[0.07] dark:bg-white/[0.025]">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('business')}
          className="group flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-ink-700 to-ink-800 px-4 text-base font-bold text-white shadow-[0_3px_10px_-2px_rgba(30,32,88,0.48),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-150 hover:-translate-y-0.5 hover:from-ink-600 hover:to-ink-700 active:translate-y-0 active:scale-[0.985] disabled:opacity-60 dark:from-indigo-400 dark:to-indigo-500 dark:text-zinc-950 dark:hover:from-indigo-300 dark:hover:to-indigo-400"
        >
          <Briefcase aria-hidden className="size-5" />
          Business
          <kbd className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-xs font-semibold text-white ring-1 ring-white/25 dark:bg-zinc-950/20 dark:text-zinc-950 dark:ring-zinc-950/25">
            B
          </kbd>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('personal')}
          className="group flex min-h-14 items-center justify-center gap-2.5 rounded-xl bg-white px-4 text-base font-bold text-zinc-900 shadow-[0_1px_3px_rgba(24,24,27,0.06)] ring-1 ring-stone-200/95 transition-all duration-150 hover:-translate-y-0.5 hover:bg-stone-50 hover:shadow-md hover:ring-stone-300 active:translate-y-0 active:scale-[0.985] disabled:opacity-60 dark:bg-white/[0.06] dark:text-white dark:ring-white/10 dark:hover:bg-white/[0.11]"
        >
          <House aria-hidden className="size-5 text-zinc-500 dark:text-zinc-300" />
          Personal
          <Kbd className="ml-1">P</Kbd>
        </button>

        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {sameMerchant > 1
              ? `Your answer also applies to ${sameMerchant - 1} other ${tx.cleanMerchant} transaction${sameMerchant > 2 ? 's' : ''}.`
              : 'Your answer is remembered locally for this merchant.'}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-zinc-600 transition-colors hover:bg-stone-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <SkipForward aria-hidden className="size-3.5" /> Skip
          </button>
        </div>
      </div>
    </article>
  );
}
