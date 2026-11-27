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
              <span className="flex size-12 items-center justify-center rounded-xl border border-device-line bg-device-soft text-device-fg">
                <CircleCheck aria-hidden className="size-6" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">
                {decided > 0 ? 'All sorted' : 'Nothing to review'}
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-fg-muted">
                {decided > 0
                  ? `You made ${plural(decided, 'decision')}. Your laptop remembers each merchant for your next statement.`
                  : 'Every sorted transaction is already marked business or personal.'}
              </p>
              {waiting > 0 && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-3 py-1 text-xs font-medium text-fg-secondary">
                  <Cpu aria-hidden className="size-3.5 text-zinc-400" /> {plural(waiting, 'transaction')} still waiting for Laptop AI.
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
              <span className="flex size-12 items-center justify-center rounded-xl border border-review-line bg-review-soft text-review-fg">
                <Undo2 aria-hidden className="size-5" />
              </span>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-fg">
                You skipped {plural(skipped.length, 'transaction')}
              </h1>
              <p className="mt-1.5 text-sm text-fg-muted">They still need you to pick business or personal.</p>
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
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Review</h1>
          <p className="mt-0.5 text-xs text-fg-muted sm:text-sm">
            <span className="font-medium text-review-fg tabular-nums">{plural(remaining, 'decision')} left</span>
            {decided > 0 && <span className="tabular-nums"> · {decided} done so far</span>}
          </p>
        </div>
        <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={() => navigate('transactions')}>
          See full list
        </Button>
      </div>

      <ProgressBar value={percent} label="Review progress" tone="device" />

      {/* Minimal stacked triage deck */}
      <div className="relative pt-1 pb-2.5">
        {remaining > 2 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-6 bottom-0 h-4 rounded-b-xl border border-line-soft bg-surface/50"
          />
        )}
        {remaining > 1 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 bottom-1.5 h-4 rounded-b-xl border border-line bg-surface/80"
          />
        )}
        <ReviewCard key={current.id} tx={current} sameMerchant={sameMerchant} busy={busy} onDecide={(t) => void decide(t)} onSkip={skip} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-fg-muted">
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

      <p aria-live="polite" className="min-h-6 text-center text-xs text-fg-secondary">
        {last && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-device-line bg-device-soft px-3 py-1 font-medium text-device-ink">
            <Check aria-hidden className="size-3.5 shrink-0 text-device-fg" />
            <span>
              <strong className="font-semibold">{last.merchant}</strong> marked {last.type}
              {last.applied > 1 ? ` · used for ${last.applied} transactions` : ''}.
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
      className="card-in relative overflow-hidden rounded-xl border border-line bg-surface shadow-[0_10px_30px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.65)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-sunken px-6 py-3">
        <time dateTime={tx.date} className="text-xs font-medium text-fg-muted tabular-nums">
          {formatShortDate(tx.date)}
        </time>
        <Badge tone="neutral">
          <History aria-hidden className="size-3 text-zinc-400" />
          {sameMerchant > 1 ? `Applies to ${sameMerchant} transactions` : 'Remembered for next time'}
        </Badge>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3.5">
            <MerchantAvatar name={tx.cleanMerchant} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-fg">{tx.cleanMerchant}</h2>
              <p
                className="mt-1 inline-block max-w-full truncate rounded bg-subtle px-2 py-0.5 font-mono text-[11px] text-fg-secondary"
                title={tx.rawDescription}
              >
                {tx.rawDescription}
              </p>
            </div>
          </div>
          <p className={`text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${moneyIn ? 'text-device-fg' : 'text-fg'}`}>
            {moneyIn ? '+' : ''}
            {formatMoney(tx.amount)}
          </p>
        </div>

        <ExplainMerchant tx={tx} />

        {tx.reviewReason && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-review-line bg-review-soft px-3.5 py-2.5 text-xs leading-relaxed text-review-ink">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-review-fg" />
            <span>{tx.reviewReason}</span>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label htmlFor={`cat-${tx.id}`} className="text-xs font-medium text-fg-muted">
            Category
          </label>
          <select
            id={`cat-${tx.id}`}
            value={tx.category ?? 'Other'}
            onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
            className="min-h-8.5 rounded-lg border border-line bg-raised px-3 text-[13px] font-medium text-fg transition-colors hover:border-line-strong focus:border-focus focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-surface text-fg">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-line-soft bg-sunken px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('business')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-inverse px-4 text-sm font-medium text-on-inverse transition-colors duration-150 hover:bg-inverse-hover active:scale-[0.99] disabled:opacity-50"
        >
          <Briefcase aria-hidden className="size-4" />
          Business
          <kbd className="ml-1 rounded border border-on-inverse/20 bg-on-inverse/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-on-inverse">
            B
          </kbd>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('personal')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm font-medium text-fg transition-colors duration-150 hover:border-line-strong hover:bg-subtle active:scale-[0.99] disabled:opacity-50"
        >
          <House aria-hidden className="size-4 text-fg-muted" />
          Personal
          <Kbd className="ml-1">P</Kbd>
        </button>

        <div className="col-span-2 mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
          <span>
            {sameMerchant > 1
              ? `Also applies to ${sameMerchant - 1} other ${tx.cleanMerchant} transaction${sameMerchant > 2 ? 's' : ''}.`
              : 'Your laptop remembers this for the merchant.'}
          </span>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-7 items-center gap-1 rounded-md px-2 font-medium text-fg-muted transition-colors hover:bg-emphasis hover:text-fg"
          >
            <SkipForward aria-hidden className="size-3.5" /> Skip
          </button>
        </div>
      </div>
    </article>
  );
}
