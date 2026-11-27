// Labeling results and one-click review. Rows appear labeled one by one while the
// on-device model streams; rule-labeled rows are ready immediately.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Cpu,
  FileUp,
  Inbox,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { MerchantAvatar } from '../components/MerchantAvatar';
import { Badge, Button, Card, Kbd, ProgressBar } from '../components/ui';
import { navigate, resetSessionState, setCategoryByUser, setTypeByUser, startDemo } from '../lib/state/actions';
import { clearAllData, db, type Transaction } from '../lib/data/db';
import { deviceStore } from '../lib/state/device';
import { formatMoney, formatSeconds, formatShortDate, plural } from '../lib/util/format';
import { cloudRetryStore } from '../lib/ai/cloudCall';
import { runCloudLabelingWithConsent } from '../lib/ai/consentLabeling';
import { labelingStore, recentArrivals, runOnDeviceLabeling } from '../lib/ai/labelingRunner';
import { NoModelChoices } from '../components/ConsentFallback';
import { useStore } from '../lib/util/store';
import { useCountUp } from '../lib/util/useCountUp';
import { CATEGORIES, type Category } from '../lib/core/taxonomy';

type Filter = 'all' | 'review' | 'business' | 'personal' | 'waiting';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['review', 'Needs review'],
  ['business', 'Business'],
  ['personal', 'Personal'],
  ['waiting', 'Waiting for AI'],
];

const SOURCE_META: Record<Exclude<Transaction['source'], 'pending'>, { text: string; dot: string; textClass: string }> = {
  cloud: { text: 'Cloud AI · with your OK', dot: 'bg-cloud', textClass: 'text-cloud-fg' },
  rule: { text: 'Saved rule', dot: 'bg-fg-faint', textClass: 'text-fg-muted' },
  memory: { text: 'Remembered', dot: 'bg-fg-faint', textClass: 'text-fg-muted' },
  'on-device': { text: 'Laptop AI', dot: 'bg-device', textClass: 'text-device-fg' },
  you: { text: 'You', dot: 'bg-inverse', textClass: 'text-fg-secondary' },
};

function sum(rows: Transaction[]): number {
  return rows.reduce((total, t) => total + Math.abs(t.amount), 0);
}

export function TransactionsView() {
  const transactions = useLiveQuery(
    async () => (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row),
    [],
  );
  const imports = useLiveQuery(() => db.imports.orderBy('importedAt').toArray(), [], []);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  if (transactions === undefined) {
    return (
      <Card className="space-y-4">
        <div className="skeleton h-6 w-44" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }
  if (transactions.length === 0) return <EmptyState />;

  const review = transactions.filter((t) => t.needsReview);
  const waiting = transactions.filter((t) => t.source === 'pending');
  const business = transactions.filter((t) => t.type === 'business');
  const personal = transactions.filter((t) => t.type === 'personal');
  const counts: Record<Filter, number> = {
    all: transactions.length,
    review: review.length,
    business: business.length,
    personal: personal.length,
    waiting: waiting.length,
  };
  const byFilter = { all: transactions, review, business, personal, waiting }[filter];
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? byFilter.filter(
        (t) =>
          t.cleanMerchant.toLowerCase().includes(needle) ||
          t.rawDescription.toLowerCase().includes(needle) ||
          (t.category ?? '').toLowerCase().includes(needle),
      )
    : byFilter;

  const businessOutSum = sum(business.filter((t) => t.amount < 0));
  const personalOut = personal.filter((t) => t.amount < 0);
  const personalOutSum = sum(personalOut);
  const personalIn = personal.filter((t) => t.amount > 0);
  const unsortedSum = sum([...review, ...waiting]);
  const splitTotal = businessOutSum + personalOutSum + unsortedSum;
  const hasDemo = transactions.some((t) => t.isDemo);

  const startOver = async () => {
    await clearAllData();
    resetSessionState();
    setConfirmReset(false);
    navigate('welcome');
  };

  const openReview = () => navigate('review');
  const fileNames = [...new Set(imports.map((i) => i.fileName))].join(', ');

  return (
    <div className="min-w-0 space-y-4">
      {/* CLEAN PAGE HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Transactions</h1>
            {hasDemo && <Badge tone="neutral">Demo data</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-fg-muted sm:text-sm" title={fileNames}>
            {plural(counts.all, 'transaction')}
            {fileNames && ` from ${fileNames}`}
          </p>
        </div>

        {confirmReset ? (
          <div
            role="group"
            aria-label="Confirm deleting your data"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-1.5"
          >
            <span className="text-xs font-medium text-danger-ink">Delete all transactions and records?</span>
            <Button variant="danger" className="min-h-7 px-2.5 text-xs" onClick={() => void startOver()}>
              Delete
            </Button>
            <Button variant="ghost" className="min-h-7 px-2.5 text-xs" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={() => setConfirmReset(true)}>
            <RotateCcw aria-hidden className="size-3.5" /> Start over
          </Button>
        )}
      </div>

      {/* UNIFIED MERCURY-STYLE HAIRLINE METRIC STRIP */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <dl className="grid grid-cols-2 divide-y divide-line-soft xl:grid-cols-4 xl:divide-x xl:divide-y-0">
          <Stat
            label="Business spending"
            value={businessOutSum}
            note={plural(business.filter((t) => t.amount < 0).length, 'transaction')}
            className="border-r border-line-soft xl:border-r-0"
          />
          <Stat
            label="Personal spending"
            value={personalOutSum}
            note={
              personalIn.length > 0
                ? `${plural(personalOut.length, 'transaction')} · +${formatMoney(sum(personalIn))} in`
                : plural(personalOut.length, 'transaction')
            }
          />
          <Stat
            label="Business income"
            value={sum(business.filter((t) => t.amount > 0))}
            note={plural(business.filter((t) => t.amount > 0).length, 'payment')}
            valueTone="text-device-fg"
            className="border-r border-line-soft xl:border-r-0"
          />
          <Stat
            label="Not sorted yet"
            value={unsortedSum}
            note={`${review.length} to review · ${waiting.length} waiting for AI`}
            valueTone={unsortedSum > 0 ? 'text-review-fg' : 'text-fg'}
          />
        </dl>

        {splitTotal > 0 && (
          <div className="border-t border-line-soft bg-sunken px-4 py-2.5">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
              {businessOutSum > 0 && (
                <span
                  className="h-full bg-inverse transition-[width] duration-500"
                  style={{ width: `${(businessOutSum / splitTotal) * 100}%` }}
                />
              )}
              {personalOutSum > 0 && (
                <span
                  className="h-full bg-fg-faint transition-[width] duration-500"
                  style={{ width: `${(personalOutSum / splitTotal) * 100}%` }}
                />
              )}
              {unsortedSum > 0 && (
                <span
                  className="h-full bg-review transition-[width] duration-500"
                  style={{ width: `${(unsortedSum / splitTotal) * 100}%` }}
                />
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-inverse" />
                Business {Math.round((businessOutSum / splitTotal) * 100)}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-fg-faint" />
                Personal {Math.round((personalOutSum / splitTotal) * 100)}%
              </span>
              {unsortedSum > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-review-fg">
                  <span aria-hidden className="size-1.5 rounded-full bg-review" />
                  Unsorted {Math.round((unsortedSum / splitTotal) * 100)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <LabelingStatus waiting={waiting.length} />

      {review.length > 0 && filter !== 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-review-line bg-surface px-4 py-3">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-review" />
            <p className="text-[13px] text-fg-secondary">
              <span className="font-semibold text-fg">{plural(review.length, 'transaction')} need your call.</span> Each one takes
              one click, and your laptop remembers it for next time.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto min-h-8 px-3 text-xs" onClick={openReview}>
            Review now <ArrowRight aria-hidden className="size-3.5" />
          </Button>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div
          role="group"
          aria-label="Filter transactions"
          className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
        >
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 ${
                filter === id
                  ? 'bg-inverse text-on-inverse'
                  : 'text-fg-secondary hover:bg-subtle hover:text-fg'
              }`}
            >
              {label}
              <span
                className={`text-[11px] tabular-nums ${
                  filter === id
                    ? 'opacity-75'
                    : id === 'review' && counts.review > 0
                      ? 'font-semibold text-review-fg'
                      : 'text-fg-muted'
                }`}
              >
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter merchant or category…"
            aria-label="Filter transactions by merchant or category"
            className="min-h-8.5 w-full rounded-lg border border-line bg-surface py-1.5 pr-8 pl-8.5 text-[13px] text-fg transition-colors placeholder:text-fg-faint hover:border-line-strong focus:border-focus focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-fg-muted hover:bg-subtle hover:text-fg"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filter === 'review' && review.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          Tip: click a row&apos;s Business/Personal switch, then press <Kbd>B</Kbd> or <Kbd>P</Kbd>. It jumps to the next row for you.
        </p>
      )}

      {/* MERCURY-GRADE TRANSACTION LEDGER TABLE */}
      <div className="relative max-w-full overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[540px] text-[13px]">
          <caption className="sr-only">Transactions, {FILTERS.find(([id]) => id === filter)?.[1]}</caption>
          <thead className="border-b border-line bg-sunken text-left text-[11px] font-medium text-fg-muted">
            <tr>
              <th scope="col" className="py-2.5 pr-2 pl-4 whitespace-nowrap">
                Date
              </th>
              <th scope="col" className="px-2.5 py-2.5">
                Merchant
              </th>
              <th scope="col" className="px-2.5 py-2.5 text-right whitespace-nowrap">
                Amount
              </th>
              <th scope="col" className="px-2.5 py-2.5 whitespace-nowrap">
                Type
              </th>
              <th scope="col" className="py-2.5 pr-4 pl-2.5">
                Category
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {visible.map((t) => (
              <Row key={t.id} tx={t} filter={filter} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            {needle ? (
              <>
                <p className="text-sm font-medium text-fg">No matching transactions</p>
                <p className="text-xs text-fg-muted">Nothing matched &ldquo;{query.trim()}&rdquo; in this filter.</p>
                <Button variant="ghost" className="mt-2 min-h-8 text-xs" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : filter === 'review' ? (
              <>
                <CircleCheck aria-hidden className="size-6 text-device-fg" />
                <p className="mt-1 text-sm font-medium text-fg">Nothing left to review</p>
                <p className="text-xs text-fg-muted">Every transaction is marked business or personal.</p>
              </>
            ) : (
              <p className="text-xs text-fg-muted">No transactions in this view.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  valueTone = 'text-fg',
  className = '',
}: {
  label: string;
  value: number;
  note: string;
  valueTone?: string;
  className?: string;
}) {
  const shown = useCountUp(value);
  return (
    <div className={`px-4 py-3.5 ${className}`}>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
      <dd className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${valueTone}`}>{formatMoney(shown)}</dd>
      <dd className="mt-0.5 text-[11px] text-fg-muted">{note}</dd>
    </div>
  );
}

function Row({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const labeled = tx.source !== 'pending';
  const meta = labeled ? SOURCE_META[tx.source as Exclude<Transaction['source'], 'pending'>] : undefined;
  const justArrived = tx.source === 'on-device' && recentArrivals.has(tx.id);

  return (
    <tr
      className={`align-top transition-colors hover:bg-sunken ${justArrived ? 'row-arrive' : ''} ${
        tx.needsReview ? 'bg-review-soft/40' : ''
      }`}
    >
      <td
        className={`py-3 pr-2 pl-4 whitespace-nowrap text-xs text-fg-muted tabular-nums ${
          tx.needsReview ? 'border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
        }`}
      >
        <time dateTime={tx.date}>{formatShortDate(tx.date)}</time>
      </td>
      <td className="px-2.5 py-3">
        <div className="flex items-start gap-2.5">
          <MerchantAvatar name={tx.cleanMerchant} size="sm" className="mt-0.5 hidden xl:inline-flex" />
          <div className="min-w-0">
            <div className="font-medium text-fg">{tx.cleanMerchant}</div>
            <div className="mt-0.5 max-w-[10rem] truncate font-mono text-[11px] text-fg-muted xl:max-w-[15rem]" title={tx.rawDescription}>
              {tx.rawDescription}
            </div>
            {tx.needsReview && tx.reviewReason && (
              <div className="mt-1 inline-flex items-start gap-1 text-[11px] font-medium text-review-fg">
                <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0 text-review-fg" />
                {tx.reviewReason}
              </div>
            )}
          </div>
        </div>
      </td>
      <td
        className={`px-2.5 py-3 text-right font-medium whitespace-nowrap tabular-nums ${
          tx.amount > 0 ? 'text-device-fg' : 'text-fg'
        }`}
      >
        {tx.amount > 0 ? '+' : ''}
        {formatMoney(tx.amount)}
      </td>
      <td className="px-2.5 py-3">
        {labeled ? (
          <TypeToggle tx={tx} filter={filter} />
        ) : (
          <>
            <span aria-hidden className="skeleton block h-7 w-28" />
            <span className="sr-only">Waiting for Laptop AI</span>
          </>
        )}
      </td>
      <td className="py-3 pr-4 pl-2.5">
        {labeled ? (
          <div className="flex flex-col items-start gap-1">
            <select
              aria-label={`Category for ${tx.cleanMerchant}`}
              value={tx.category ?? 'Other'}
              onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
              className="-mx-1.5 max-w-[9.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-fg-secondary transition-colors hover:border-line hover:bg-raised focus:border-focus focus:bg-raised focus:outline-none xl:max-w-[12.5rem]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-surface text-fg">
                  {c}
                </option>
              ))}
            </select>
            {meta && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.textClass}`}>
                <span aria-hidden className={`size-1.5 rounded-full ${meta.dot}`} />
                {meta.text}
              </span>
            )}
          </div>
        ) : (
          <span aria-hidden className="skeleton block h-4 w-24" />
        )}
      </td>
    </tr>
  );
}

function focusToggle(index: number) {
  const groups = document.querySelectorAll<HTMLElement>('[data-type-toggle]');
  if (groups.length === 0) return;
  const target = groups[Math.min(index, groups.length - 1)];
  target?.querySelector<HTMLButtonElement>('button')?.focus();
}

function TypeToggle({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const choose = async (type: 'business' | 'personal', moveFocus: boolean) => {
    const groups = [...document.querySelectorAll<HTMLElement>('[data-type-toggle]')];
    const index = groups.findIndex((g) => g.dataset.typeToggle === tx.id);
    await setTypeByUser(tx.id, type);
    if (!moveFocus) return;
    const next = filter === 'review' ? index : index + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => focusToggle(next)));
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (event.altKey || event.ctrlKey || event.metaKey || (key !== 'b' && key !== 'p')) return;
    event.preventDefault();
    void choose(key === 'b' ? 'business' : 'personal', true);
  };

  const option = (type: 'business' | 'personal', label: string, activeClass: string) => {
    const active = tx.type === type;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => void choose(type, false)}
        className={`min-h-7 rounded-md px-2 text-xs font-medium transition-colors duration-150 ${
          active ? activeClass : 'text-fg-muted hover:text-fg'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        role="group"
        aria-label={`${tx.cleanMerchant}, ${formatMoney(tx.amount)}: business or personal`}
        data-type-toggle={tx.id}
        onKeyDown={onKeyDown}
        className={`inline-flex gap-0.5 rounded-lg border p-0.5 ${
          tx.type === 'unsure'
            ? 'border-amber-300 bg-review-soft dark:border-amber-500/35'
            : 'border-line bg-sunken'
        }`}
      >
        {option('business', 'Business', 'bg-inverse text-on-inverse')}
        {option('personal', 'Personal', 'bg-zinc-600 text-white')}
      </div>
      {tx.type === 'unsure' && <Badge tone="review">Decide</Badge>}
    </div>
  );
}

function LabelingStatus({ waiting }: { waiting: number }) {
  const state = useStore(labelingStore);
  const device = useStore(deviceStore);
  const { retrying } = useStore(cloudRetryStore);

  if (state.status === 'running') {
    const percent = state.total ? Math.round((state.done / state.total) * 100) : 0;
    const inCloud = state.where === 'cloud';
    return (
      <div
        className={`space-y-2.5 rounded-xl border bg-surface px-4 py-3.5 ${
          inCloud ? 'border-cloud-line' : 'border-device-line'
        }`}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-fg">
          <LoaderCircle
            aria-hidden
            className={`size-3.5 animate-spin motion-reduce:animate-none ${
              inCloud ? 'text-cloud-fg' : 'text-device-fg'
            }`}
          />
          <span className="font-medium">{inCloud ? 'Sorting with Cloud AI, with your OK' : 'Sorting on your laptop'}</span>
          <span className="text-xs text-fg-muted tabular-nums">
            {state.done} of {state.total} transactions · step {state.batch} of {state.batches}
          </span>
          {state.firstItemMs !== undefined && (
            <span className="text-xs text-fg-muted tabular-nums">· first result in {formatSeconds(state.firstItemMs)}</span>
          )}
          {retrying && <span className="text-xs font-medium text-review-fg">· Cloud AI is busy, trying again…</span>}
          <span className="ml-auto text-xs font-semibold tabular-nums">{percent}%</span>
        </div>
        <ProgressBar value={percent} label="Sorting progress" tone={inCloud ? 'cloud' : 'device'} />
      </div>
    );
  }

  if (waiting > 0 && state.status !== 'error' && device.status !== 'available' && device.status !== 'checking') {
    return <NoModelChoices waiting={waiting} />;
  }

  if (state.status === 'error') {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-xs text-danger-ink"
      >
        <CircleAlert aria-hidden className="size-4 shrink-0 text-danger-fg" />
        <p className="min-w-[12rem] flex-1">Sorting stopped: {state.message}</p>
        {waiting > 0 && (
          <Button
            variant="secondary"
            className="min-h-8 px-3 text-xs"
            onClick={() => void (state.where === 'cloud' ? runCloudLabelingWithConsent() : runOnDeviceLabeling())}
          >
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (waiting > 0) {
    const ready = device.status === 'available';
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-[13px]">
        <Cpu aria-hidden className="size-4 shrink-0 text-device-fg" />
        <p className="min-w-[12rem] flex-1 text-fg-secondary">
          <strong className="font-semibold text-fg">{plural(waiting, 'transaction')}</strong> left to sort.
          {!ready && <span className="text-fg-muted"> Laptop AI isn&apos;t ready in this browser.</span>}
        </p>
        {ready ? (
          <Button variant="device" className="min-h-8 px-3 text-xs" onClick={() => void runOnDeviceLabeling()}>
            <Cpu aria-hidden className="size-3.5" /> Sort on my laptop
          </Button>
        ) : (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => navigate('welcome')}>
            Set up Laptop AI
          </Button>
        )}
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-device-line bg-device-soft px-4 py-2.5 text-xs text-device-ink">
        <CircleCheck aria-hidden className="size-3.5 shrink-0 text-device-fg" />
        <span>
          {state.where === 'cloud'
            ? 'All sorted. The transactions you agreed to share are listed in the Privacy panel.'
            : 'All sorted, and your transactions stayed on your laptop.'}
        </span>
        {state.firstItemMs !== undefined && (
          <span className="text-device-fg/75 tabular-nums">
            First result in {formatSeconds(state.firstItemMs)}.
          </span>
        )}
      </p>
    );
  }

  return null;
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-sunken text-fg-muted">
        <Inbox aria-hidden className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-fg">No transactions yet</h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">
        Import a CSV file from your bank, or try the demo with 40 made-up transactions. Either way, nothing is uploaded.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button variant="primary" onClick={() => void startDemo()}>
          <Play aria-hidden className="size-3.5 fill-current" /> Try demo data
        </Button>
        <Button onClick={() => navigate('import')}>
          <FileUp aria-hidden className="size-3.5" /> Import your CSV
        </Button>
      </div>
    </Card>
  );
}
