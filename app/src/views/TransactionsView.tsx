// Labeling results and one-click review. Rows appear labeled one by one while the
// on-device model streams; rule-labeled rows are ready immediately.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Cloud,
  Cpu,
  FileUp,
  History,
  Inbox,
  ListChecks,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Badge, Button, Card, ProgressBar } from '../components/ui';
import { navigate, setCategoryByUser, setTypeByUser, startDemo } from '../lib/state/actions';
import { clearAllData, db, type Transaction } from '../lib/data/db';
import { deviceStore } from '../lib/state/device';
import { formatMoney, formatSeconds, formatShortDate, plural } from '../lib/util/format';
import { resetAdvisor } from '../lib/ai/advisorStore';
import { cloudRetryStore } from '../lib/ai/cloudCall';
import { runCloudLabelingWithConsent } from '../lib/ai/consentLabeling';
import { resetExplanations } from '../lib/ai/explainer';
import { resetSummary } from '../lib/ai/reporter';
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

const SOURCE_BADGE: Record<Exclude<Transaction['source'], 'pending'>, { text: string; tone: 'device' | 'cloud' | 'neutral' | 'ink'; icon: LucideIcon }> = {
  cloud: { text: 'Cloud AI · consent', tone: 'cloud', icon: Cloud },
  rule: { text: 'Rule', tone: 'neutral', icon: ListChecks },
  memory: { text: 'Remembered', tone: 'neutral', icon: History },
  'on-device': { text: 'On-device AI', tone: 'device', icon: Cpu },
  you: { text: 'You', tone: 'ink', icon: UserCheck },
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

  if (transactions === undefined) return <Card>Loading…</Card>;
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

  const personalOut = personal.filter((t) => t.amount < 0);
  const personalIn = personal.filter((t) => t.amount > 0);
  const hasDemo = transactions.some((t) => t.isDemo);

  const startOver = async () => {
    await clearAllData();
    resetAdvisor();
    resetSummary();
    resetExplanations();
    recentArrivals.clear();
    labelingStore.set({ status: 'idle', done: 0, total: 0, batch: 0, batches: 0, firstItemMs: undefined, message: undefined });
    setConfirmReset(false);
    navigate('welcome');
  };

  const openReview = () => navigate('review');

  const fileNames = [...new Set(imports.map((i) => i.fileName))].join(', ');

  return (
    <div className="space-y-4">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
              {hasDemo && <Badge tone="neutral">Demo data</Badge>}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-600" title={fileNames}>
              {plural(counts.all, 'transaction')}
              {fileNames && ` from ${fileNames}`}
            </p>
          </div>
          {confirmReset ? (
            <div role="group" aria-label="Confirm clearing local data" className="ml-auto flex flex-wrap items-center gap-2 rounded-md bg-rose-50 px-3 py-1.5 ring-1 ring-rose-200">
              <span className="text-xs font-medium text-rose-900">Clear transactions &amp; ledger?</span>
              <Button variant="danger" className="min-h-8 px-2.5 text-xs" onClick={() => void startOver()}>
                Delete
              </Button>
              <Button variant="ghost" className="min-h-8 px-2.5 text-xs" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="ml-auto" onClick={() => setConfirmReset(true)}>
              <RotateCcw aria-hidden className="size-4" /> Start over
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat
            label="Business spending"
            value={sum(business.filter((t) => t.amount < 0))}
            note={plural(business.filter((t) => t.amount < 0).length, 'transaction')}
            accent="bg-ink-800"
          />
          <Stat
            label="Personal spending"
            value={sum(personalOut)}
            note={
              personalIn.length > 0
                ? `${plural(personalOut.length, 'transaction')} · +${formatMoney(sum(personalIn))} in`
                : plural(personalOut.length, 'transaction')
            }
            accent="bg-slate-600"
          />
          <Stat
            label="Business income"
            value={sum(business.filter((t) => t.amount > 0))}
            note={plural(business.filter((t) => t.amount > 0).length, 'payment')}
            accent="bg-emerald-600"
          />
          <Stat
            label="Not sorted yet"
            value={sum([...review, ...waiting])}
            note={`${review.length} to review · ${waiting.length} waiting`}
            accent="bg-amber-500"
          />
        </dl>

        <LabelingStatus waiting={waiting.length} />
      </Card>

      {review.length > 0 && filter !== 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{plural(review.length, 'transaction')} need your decision.</span> Each one takes a single click, and
              your answer is remembered for that merchant.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto min-h-9" onClick={openReview}>
            Review now <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter transactions" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-200/70 p-1">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-150 ${
                filter === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:bg-white/60'
              }`}
            >
              {label}
              <span className={`text-xs tabular-nums ${id === 'review' && counts.review > 0 ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter merchant or category…"
            aria-label="Filter transactions by merchant or category"
            className="min-h-9 w-full rounded-md border border-slate-300 bg-white py-1 pr-8 pl-8 text-sm placeholder:text-slate-500 focus:border-ink-800"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filter === 'review' && review.length > 0 && (
        <p className="text-xs text-slate-600">
          Tip: focus a row&apos;s buttons and press <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">B</kbd> or{' '}
          <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">P</kbd>. Focus moves to the next row.
        </p>
      )}

      <div className="relative overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[600px] text-sm">
          <caption className="sr-only">Transactions, {FILTERS.find(([id]) => id === filter)?.[1]}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th scope="col" className="py-2.5 pr-2 pl-4 font-medium">Date</th>
              <th scope="col" className="w-[36%] px-3 py-2.5 font-medium">Merchant</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Business or personal</th>
              <th scope="col" className="py-2.5 pr-4 pl-3 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
              <Row key={t.id} tx={t} filter={filter} />
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            {needle ? (
              <>
                <p className="font-medium">No matching transactions</p>
                <p className="text-sm text-slate-600">Nothing matched &ldquo;{query.trim()}&rdquo; in this filter.</p>
                <Button variant="ghost" className="mt-2 min-h-8 text-xs" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : filter === 'review' ? (
              <>
                <CircleCheck aria-hidden className="size-6 text-emerald-700" />
                <p className="font-medium">Nothing left to review</p>
                <p className="text-sm text-slate-600">Every transaction has a business or personal label.</p>
              </>
            ) : (
              <p className="text-sm text-slate-600">No transactions in this view.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, note, accent }: { label: string; value: number; note: string; accent: string }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span aria-hidden className={`size-2 rounded-full ${accent}`} />
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(shown)}</dd>
      <dd className="text-xs text-slate-600">{note}</dd>
    </div>
  );
}

function Row({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const labeled = tx.source !== 'pending';
  const badge = labeled ? SOURCE_BADGE[tx.source as Exclude<Transaction['source'], 'pending'>] : undefined;
  const arrivedAt = recentArrivals.get(tx.id);
  const justArrived = tx.source === 'on-device' && arrivedAt !== undefined && Date.now() - arrivedAt < 2000;

  return (
    <tr className={`border-t border-slate-100 align-top transition-colors hover:bg-slate-50/70 ${justArrived ? 'row-arrive' : ''}`}>
      <td className="py-3 pr-2 pl-4 whitespace-nowrap text-slate-700 tabular-nums">
        <time dateTime={tx.date}>{formatShortDate(tx.date)}</time>
      </td>
      <td className="px-3 py-3">
        <div className="font-medium">{tx.cleanMerchant}</div>
        <div className="max-w-[18rem] truncate font-mono text-xs text-slate-600" title={tx.rawDescription}>
          {tx.rawDescription}
        </div>
        {tx.needsReview && tx.reviewReason && (
          <div className="mt-1.5 inline-flex items-start gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900">
            <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
            {tx.reviewReason}
          </div>
        )}
      </td>
      <td className={`px-3 py-3 text-right whitespace-nowrap tabular-nums ${tx.amount > 0 ? 'font-medium text-emerald-800' : ''}`}>
        {tx.amount > 0 ? '+' : ''}
        {formatMoney(tx.amount)}
      </td>
      <td className="px-3 py-3">
        {labeled ? (
          <TypeToggle tx={tx} filter={filter} />
        ) : (
          <>
            <span aria-hidden className="skeleton block h-8 w-36" />
            <span className="sr-only">Waiting for the on-device model</span>
          </>
        )}
      </td>
      <td className="py-3 pr-4 pl-3">
        {labeled ? (
          <div className="flex flex-col items-start gap-1">
            <select
              aria-label={`Category for ${tx.cleanMerchant}`}
              value={tx.category ?? 'Other'}
              onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
              className="-mx-1.5 max-w-[12rem] rounded border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-slate-800 transition-colors hover:border-slate-300 hover:bg-white focus:border-ink-800 focus:bg-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {badge && (
              <Badge tone={badge.tone}>
                <badge.icon aria-hidden className="size-3" />
                {badge.text}
              </Badge>
            )}
          </div>
        ) : (
          <span aria-hidden className="skeleton block h-4 w-28" />
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
    // In "Needs review" the decided row leaves the list, so the next row takes its place.
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
        className={`min-h-9 px-3 text-xs font-semibold transition-colors duration-150 ${active ? activeClass : 'bg-white text-slate-700 hover:bg-slate-100'}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label={`${tx.cleanMerchant}, ${formatMoney(tx.amount)}: business or personal`}
        data-type-toggle={tx.id}
        onKeyDown={onKeyDown}
        className={`inline-flex divide-x divide-slate-300 overflow-hidden rounded-md ring-1 ${tx.type === 'unsure' ? 'ring-amber-400' : 'ring-slate-300'}`}
      >
        {option('business', 'Business', 'bg-ink-800 text-white')}
        {option('personal', 'Personal', 'bg-slate-700 text-white')}
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
      <div className={`space-y-2 rounded-md px-4 py-3 ring-1 ${inCloud ? 'bg-sky-50 ring-sky-200' : 'bg-emerald-50 ring-emerald-200'}`} aria-live="polite">
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${inCloud ? 'text-sky-900' : 'text-emerald-900'}`}>
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          <span className="font-semibold">{inCloud ? 'Labeling in the cloud, with your consent' : 'Labeling on this device'}</span>
          <span className="tabular-nums">
            {state.done} of {state.total} rows · batch {state.batch} of {state.batches}
          </span>
          {state.firstItemMs !== undefined && <span className="tabular-nums">· first label after {formatSeconds(state.firstItemMs)}</span>}
          {retrying && <span className="font-medium">· the cloud model is busy, trying again…</span>}
        </div>
        <ProgressBar value={percent} label="Labeling progress" />
      </div>
    );
  }

  if (waiting > 0 && state.status !== 'error' && device.status !== 'available' && device.status !== 'checking') {
    return <NoModelChoices waiting={waiting} />;
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
        <CircleAlert aria-hidden className="size-4 shrink-0" />
        <p className="min-w-[12rem] flex-1">Labeling stopped: {state.message}</p>
        {waiting > 0 && (
          <Button variant="secondary" className="min-h-9" onClick={() => void (state.where === 'cloud' ? runCloudLabelingWithConsent() : runOnDeviceLabeling())}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (waiting > 0) {
    const ready = device.status === 'available';
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
        <Cpu aria-hidden className="size-4 shrink-0 text-slate-600" />
        <p className="min-w-[12rem] flex-1">
          {plural(waiting, 'row')} waiting for the on-device model.
          {!ready && <span className="text-slate-600"> On-device AI is not ready in this browser.</span>}
        </p>
        {ready ? (
          <Button variant="device" className="min-h-9" onClick={() => void runOnDeviceLabeling()}>
            <Cpu aria-hidden className="size-4" /> Label on this device
          </Button>
        ) : (
          <Button variant="secondary" className="min-h-9" onClick={() => navigate('welcome')}>
            Set up on-device AI
          </Button>
        )}
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-800">
        <CircleCheck aria-hidden className="size-4" />
        {state.where === 'cloud'
          ? 'Every row is labeled. The rows you agreed to share are counted in the data boundary panel.'
          : 'Every row is labeled, and raw transactions stayed on this device.'}
        {state.firstItemMs !== undefined && <span className="text-slate-600 tabular-nums">First label after {formatSeconds(state.firstItemMs)}.</span>}
      </p>
    );
  }

  return null;
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center p-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
        <Inbox aria-hidden className="size-6 text-slate-600" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">No transactions yet</h1>
      <p className="mt-2 max-w-md text-sm text-slate-700">Import a CSV from your bank, or try the demo with 40 invented transactions. Either way, nothing is uploaded.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => void startDemo()}>
          <Play aria-hidden className="size-4" /> Try with demo data
        </Button>
        <Button onClick={() => navigate('import')}>
          <FileUp aria-hidden className="size-4" /> Import your CSV
        </Button>
      </div>
    </Card>
  );
}
