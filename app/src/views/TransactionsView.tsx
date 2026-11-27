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

const SOURCE_META: Record<Exclude<Transaction['source'], 'pending'>, { text: string; dot: string; textClass: string }> = {
  cloud: { text: 'Cloud AI · consent', dot: 'bg-indigo-600 dark:bg-indigo-400', textClass: 'text-indigo-700 dark:text-indigo-400' },
  rule: { text: 'Rule', dot: 'bg-zinc-400 dark:bg-zinc-500', textClass: 'text-zinc-500 dark:text-zinc-400' },
  memory: { text: 'Remembered', dot: 'bg-zinc-400 dark:bg-zinc-500', textClass: 'text-zinc-500 dark:text-zinc-400' },
  'on-device': { text: 'On-device AI', dot: 'bg-emerald-600 dark:bg-emerald-400', textClass: 'text-emerald-700 dark:text-emerald-400' },
  you: { text: 'You', dot: 'bg-zinc-900 dark:bg-zinc-200', textClass: 'text-zinc-700 dark:text-zinc-300' },
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
    <div className="min-w-0 space-y-4">
      {/* CLEAN PAGE HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Transactions</h1>
            {hasDemo && <Badge tone="neutral">Demo data</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-zinc-500 sm:text-sm dark:text-zinc-400" title={fileNames}>
            {plural(counts.all, 'transaction')}
            {fileNames && ` from ${fileNames}`}
          </p>
        </div>

        {confirmReset ? (
          <div
            role="group"
            aria-label="Confirm clearing local data"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 dark:border-rose-500/20 dark:bg-rose-500/10"
          >
            <span className="text-xs font-medium text-rose-900 dark:text-rose-200">Clear transactions &amp; ledger?</span>
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
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111114]">
        <dl className="grid grid-cols-2 divide-y divide-zinc-100 xl:grid-cols-4 xl:divide-x xl:divide-y-0 dark:divide-white/[0.06]">
          <Stat
            label="Business spending"
            value={businessOutSum}
            note={plural(business.filter((t) => t.amount < 0).length, 'transaction')}
            className="border-r border-zinc-100 xl:border-r-0 dark:border-white/[0.06]"
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
            valueTone="text-emerald-700 dark:text-emerald-400"
            className="border-r border-zinc-100 xl:border-r-0 dark:border-white/[0.06]"
          />
          <Stat
            label="Not sorted yet"
            value={unsortedSum}
            note={`${review.length} to review · ${waiting.length} waiting`}
            valueTone={unsortedSum > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-950 dark:text-white'}
          />
        </dl>

        {splitTotal > 0 && (
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.015]">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[0.07]" aria-hidden>
              {businessOutSum > 0 && (
                <span
                  className="h-full bg-zinc-900 transition-[width] duration-500 dark:bg-zinc-200"
                  style={{ width: `${(businessOutSum / splitTotal) * 100}%` }}
                />
              )}
              {personalOutSum > 0 && (
                <span
                  className="h-full bg-zinc-400 transition-[width] duration-500 dark:bg-zinc-600"
                  style={{ width: `${(personalOutSum / splitTotal) * 100}%` }}
                />
              )}
              {unsortedSum > 0 && (
                <span
                  className="h-full bg-amber-500 transition-[width] duration-500 dark:bg-amber-400"
                  style={{ width: `${(unsortedSum / splitTotal) * 100}%` }}
                />
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-zinc-900 dark:bg-zinc-200" />
                Business {Math.round((businessOutSum / splitTotal) * 100)}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                Personal {Math.round((personalOutSum / splitTotal) * 100)}%
              </span>
              {unsortedSum > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                  <span aria-hidden className="size-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                  Unsorted {Math.round((unsortedSum / splitTotal) * 100)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <LabelingStatus waiting={waiting.length} />

      {review.length > 0 && filter !== 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/80 bg-white px-4 py-3 dark:border-amber-500/20 dark:bg-[#111114]">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" />
            <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-950 dark:text-white">{plural(review.length, 'transaction')} need your decision.</span> Each one
              takes a single click and is remembered locally.
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
          className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-zinc-200/80 bg-white p-0.5 dark:border-white/[0.08] dark:bg-[#111114]"
        >
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 ${
                filter === id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100'
              }`}
            >
              {label}
              <span
                className={`text-[11px] tabular-nums ${
                  filter === id
                    ? 'opacity-75'
                    : id === 'review' && counts.review > 0
                      ? 'font-semibold text-amber-700 dark:text-amber-400'
                      : 'text-zinc-500 dark:text-zinc-400'
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
            className="min-h-8.5 w-full rounded-lg border border-zinc-200/90 bg-white py-1.5 pr-8 pl-8.5 text-[13px] text-zinc-900 transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none dark:border-white/[0.09] dark:bg-[#111114] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-white/[0.18] dark:focus:border-zinc-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-white/[0.08] dark:hover:text-white"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filter === 'review' && review.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Tip: focus a row&apos;s toggle and press <Kbd>B</Kbd> or <Kbd>P</Kbd> — focus advances automatically to the next row.
        </p>
      )}

      {/* MERCURY-GRADE TRANSACTION LEDGER TABLE */}
      <div className="relative max-w-full overflow-x-auto rounded-xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111114]">
        <table className="w-full min-w-[540px] text-[13px]">
          <caption className="sr-only">Transactions, {FILTERS.find(([id]) => id === filter)?.[1]}</caption>
          <thead className="border-b border-zinc-200/80 bg-zinc-50/60 text-left text-[11px] font-medium text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
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
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
            {visible.map((t) => (
              <Row key={t.id} tx={t} filter={filter} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            {needle ? (
              <>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">No matching transactions</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Nothing matched &ldquo;{query.trim()}&rdquo; in this filter.</p>
                <Button variant="ghost" className="mt-2 min-h-8 text-xs" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : filter === 'review' ? (
              <>
                <CircleCheck aria-hidden className="size-6 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">Nothing left to review</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Every transaction has a business or personal label.</p>
              </>
            ) : (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">No transactions in this view.</p>
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
  valueTone = 'text-zinc-950 dark:text-white',
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
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${valueTone}`}>{formatMoney(shown)}</dd>
      <dd className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">{note}</dd>
    </div>
  );
}

function Row({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const labeled = tx.source !== 'pending';
  const meta = labeled ? SOURCE_META[tx.source as Exclude<Transaction['source'], 'pending'>] : undefined;
  const justArrived = tx.source === 'on-device' && recentArrivals.has(tx.id);

  return (
    <tr
      className={`align-top transition-colors hover:bg-zinc-50/70 dark:hover:bg-white/[0.025] ${justArrived ? 'row-arrive' : ''} ${
        tx.needsReview ? 'bg-amber-50/25 dark:bg-amber-500/[0.04]' : ''
      }`}
    >
      <td
        className={`py-3 pr-2 pl-4 whitespace-nowrap text-xs text-zinc-500 tabular-nums dark:text-zinc-400 ${
          tx.needsReview ? 'border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
        }`}
      >
        <time dateTime={tx.date}>{formatShortDate(tx.date)}</time>
      </td>
      <td className="px-2.5 py-3">
        <div className="flex items-start gap-2.5">
          <MerchantAvatar name={tx.cleanMerchant} size="sm" className="mt-0.5 hidden xl:inline-flex" />
          <div className="min-w-0">
            <div className="font-medium text-zinc-950 dark:text-zinc-100">{tx.cleanMerchant}</div>
            <div className="mt-0.5 max-w-[10rem] truncate font-mono text-[11px] text-zinc-500 xl:max-w-[15rem] dark:text-zinc-400" title={tx.rawDescription}>
              {tx.rawDescription}
            </div>
            {tx.needsReview && tx.reviewReason && (
              <div className="mt-1 inline-flex items-start gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                {tx.reviewReason}
              </div>
            )}
          </div>
        </div>
      </td>
      <td
        className={`px-2.5 py-3 text-right font-medium whitespace-nowrap tabular-nums ${
          tx.amount > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-zinc-100'
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
            <span className="sr-only">Waiting for the on-device model</span>
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
              className="-mx-1.5 max-w-[9.5rem] rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-zinc-800 transition-colors hover:border-zinc-200 hover:bg-white focus:border-zinc-900 focus:bg-white focus:outline-none xl:max-w-[12.5rem] dark:text-zinc-200 dark:hover:border-white/[0.12] dark:hover:bg-zinc-900 dark:focus:border-zinc-400 dark:focus:bg-zinc-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-white text-zinc-900 dark:bg-[#111114] dark:text-zinc-100">
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
          active ? activeClass : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
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
            ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/35 dark:bg-amber-500/10'
            : 'border-zinc-200/85 bg-zinc-50 dark:border-white/[0.08] dark:bg-white/[0.03]'
        }`}
      >
        {option('business', 'Business', 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950')}
        {option('personal', 'Personal', 'bg-zinc-600 text-white dark:bg-zinc-600 dark:text-white')}
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
        className={`space-y-2.5 rounded-xl border bg-white px-4 py-3.5 dark:bg-[#111114] ${
          inCloud ? 'border-indigo-200/80 dark:border-indigo-500/25' : 'border-emerald-200/80 dark:border-emerald-500/25'
        }`}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-zinc-900 dark:text-zinc-100">
          <LoaderCircle
            aria-hidden
            className={`size-3.5 animate-spin motion-reduce:animate-none ${
              inCloud ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          />
          <span className="font-medium">{inCloud ? 'Labeling in the cloud, with your consent' : 'Labeling on this device'}</span>
          <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {state.done} of {state.total} rows · batch {state.batch} of {state.batches}
          </span>
          {state.firstItemMs !== undefined && (
            <span className="text-xs text-zinc-500 tabular-nums dark:text-zinc-400">· first label after {formatSeconds(state.firstItemMs)}</span>
          )}
          {retrying && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">· cloud model is busy, retrying…</span>}
          <span className="ml-auto text-xs font-semibold tabular-nums">{percent}%</span>
        </div>
        <ProgressBar value={percent} label="Labeling progress" tone={inCloud ? 'cloud' : 'device'} />
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
        className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
      >
        <CircleAlert aria-hidden className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <p className="min-w-[12rem] flex-1">Labeling stopped: {state.message}</p>
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-[13px] dark:border-white/[0.08] dark:bg-[#111114]">
        <Cpu aria-hidden className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <p className="min-w-[12rem] flex-1 text-zinc-700 dark:text-zinc-300">
          <strong className="font-semibold text-zinc-950 dark:text-white">{plural(waiting, 'row')}</strong> waiting for the on-device model.
          {!ready && <span className="text-zinc-500 dark:text-zinc-400"> On-device AI is not ready in this browser.</span>}
        </p>
        {ready ? (
          <Button variant="device" className="min-h-8 px-3 text-xs" onClick={() => void runOnDeviceLabeling()}>
            <Cpu aria-hidden className="size-3.5" /> Label on this device
          </Button>
        ) : (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => navigate('welcome')}>
            Set up on-device AI
          </Button>
        )}
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-2.5 text-xs text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
        <CircleCheck aria-hidden className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <span>
          {state.where === 'cloud'
            ? 'Every row is labeled. The rows you agreed to share are counted in the data boundary panel.'
            : 'Every row is labeled, and raw transactions stayed on this device.'}
        </span>
        {state.firstItemMs !== undefined && (
          <span className="text-emerald-800/75 tabular-nums dark:text-emerald-300/75">
            First label after {formatSeconds(state.firstItemMs)}.
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
      <span className="flex size-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-400">
        <Inbox aria-hidden className="size-5" />
      </span>
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">No transactions yet</h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        Import a CSV from your bank, or try the demo with 40 invented transactions. Either way, nothing is uploaded.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button variant="primary" onClick={() => void startDemo()}>
          <Play aria-hidden className="size-3.5 fill-current" /> Try with demo data
        </Button>
        <Button onClick={() => navigate('import')}>
          <FileUp aria-hidden className="size-3.5" /> Import your CSV
        </Button>
      </div>
    </Card>
  );
}
