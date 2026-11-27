// Review mode: one decision at a time instead of a spreadsheet. Each answer
// is saved as merchant memory, so the same merchant never needs asking again.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Briefcase,
  Check,
  CircleAlert,
  CircleCheck,
  Cpu,
  History,
  House,
  SkipForward,
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
      <Card className="mx-auto max-w-xl space-y-4 py-10">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </Card>
    );
  }

  const remaining = queue.length;
  const totalThisSession = decided + remaining;
  const percent = totalThisSession ? Math.round((decided / totalThisSession) * 100) : 100;

  if (!current) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="px-6 py-14 text-center">
          {remaining === 0 ? (
            <div className="flex flex-col items-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CircleCheck aria-hidden className="size-6" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {decided > 0 ? 'All sorted' : 'Nothing to review'}
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                {decided > 0
                  ? `You made ${plural(decided, 'decision')}. Each one is saved to local merchant memory for future statements.`
                  : 'Every labeled transaction already has a business or personal label.'}
              </p>
              {waiting > 0 && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
                  <Cpu aria-hidden className="size-3.5 text-zinc-400" /> {plural(waiting, 'transaction')} still wait for on-device AI.
                </p>
              )}
              <div className="mt-7 flex flex-wrap justify-center gap-2.5">
                <Button variant="primary" className="min-h-10 px-4" onClick={() => navigate('summary')}>
                  See summary &amp; export <ArrowRight aria-hidden className="size-4" />
                </Button>
                <Button className="min-h-10" onClick={() => navigate('transactions')}>
                  Back to transactions
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <Undo2 aria-hidden className="size-5" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                You skipped {plural(skipped.length, 'transaction')}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">They are still waiting for your business or personal decision.</p>
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
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Review</h1>
          <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            <span className="font-medium text-amber-700 tabular-nums dark:text-amber-300">{plural(remaining, 'decision')} left</span>
            {decided > 0 && <span className="tabular-nums"> · {decided} done this session</span>}
          </p>
        </div>
        <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={() => navigate('transactions')}>
          See all in table
        </Button>
      </div>

      <ProgressBar value={percent} label="Review progress" tone="device" />

      {/* Minimal stacked triage deck */}
      <div className="relative pt-1 pb-2.5">
        {remaining > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-4 rounded-b-xl border border-zinc-200/50 bg-white/50 dark:border-white/[0.05] dark:bg-[#111114]/50"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 bottom-1.5 h-4 rounded-b-xl border border-zinc-200/75 bg-white/80 dark:border-white/[0.07] dark:bg-[#111114]/80"
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

      <p aria-live="polite" className="min-h-6 text-center text-xs text-zinc-600 dark:text-zinc-400">
        {last && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-3 py-1 font-medium text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Check aria-hidden className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
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
      className="card-in relative overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_10px_30px_-16px_rgba(0,0,0,0.08)] dark:border-white/[0.09] dark:bg-[#111114] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.65)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/60 px-6 py-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <time dateTime={tx.date} className="text-xs font-medium text-zinc-500 tabular-nums dark:text-zinc-400">
          {formatShortDate(tx.date)}
        </time>
        <Badge tone="neutral">
          <History aria-hidden className="size-3 text-zinc-400" />
          {sameMerchant > 1 ? `Applies to ${sameMerchant} rows` : 'Saves to merchant memory'}
        </Badge>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <MerchantAvatar name={tx.cleanMerchant} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">{tx.cleanMerchant}</h2>
              <p
                className="mt-1 inline-block max-w-full truncate rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-400"
                title={tx.rawDescription}
              >
                {tx.rawDescription}
              </p>
            </div>
          </div>
          <p className={`text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${moneyIn ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'}`}>
            {moneyIn ? '+' : ''}
            {formatMoney(tx.amount)}
          </p>
        </div>

        <ExplainMerchant tx={tx} />

        {tx.reviewReason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/55 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>{tx.reviewReason}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor={`cat-${tx.id}`} className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Category
          </label>
          <select
            id={`cat-${tx.id}`}
            value={tx.category ?? 'Other'}
            onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
            className="min-h-8.5 rounded-lg border border-zinc-200/90 bg-white px-3 text-[13px] font-medium text-zinc-900 transition-colors hover:border-zinc-300 focus:border-zinc-900 focus:outline-none dark:border-white/[0.1] dark:bg-[#16161a] dark:text-zinc-100 dark:hover:border-white/[0.18] dark:focus:border-zinc-400"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-white text-zinc-900 dark:bg-[#111114] dark:text-zinc-100">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-zinc-100 bg-zinc-50/50 px-6 py-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('business')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          <Briefcase aria-hidden className="size-4" />
          Business
          <kbd className="ml-1 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-white dark:border-zinc-950/20 dark:bg-zinc-950/10 dark:text-zinc-950">
            B
          </kbd>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('personal')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-zinc-200/90 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#16161a] dark:text-white dark:hover:border-white/[0.18] dark:hover:bg-white/[0.06]"
        >
          <House aria-hidden className="size-4 text-zinc-500 dark:text-zinc-400" />
          Personal
          <Kbd className="ml-1">P</Kbd>
        </button>

        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {sameMerchant > 1
              ? `Also applies to ${sameMerchant - 1} other ${tx.cleanMerchant} transaction${sameMerchant > 2 ? 's' : ''}.`
              : 'Remembered locally for this merchant.'}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 font-medium text-zinc-500 transition-colors hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <SkipForward aria-hidden className="size-3.5" /> Skip
          </button>
        </div>
      </div>
    </article>
  );
}
