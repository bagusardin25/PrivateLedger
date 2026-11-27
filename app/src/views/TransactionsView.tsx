// Labeling results and one-click review. Rows appear labeled one by one while the
// on-device model streams; rule-labeled rows are ready immediately.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Briefcase,
  CircleAlert,
  CircleCheck,
  Clock,
  Cloud,
  Cpu,
  FileUp,
  History,
  House,
  Inbox,
  ListChecks,
  LoaderCircle,
  Play,
  RotateCcw,
  Search,
  TrendingUp,
  UserCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
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

  if (transactions === undefined) {
    return (
      <Card className="space-y-4">
        <div className="skeleton h-6 w-44" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-24 rounded-xl" />
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
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Transactions</h1>
              {hasDemo && <Badge tone="neutral">Demo data</Badge>}
            </div>
            <p className="mt-0.5 truncate text-sm text-slate-500" title={fileNames}>
              {plural(counts.all, 'transaction')}
              {fileNames && ` from ${fileNames}`}
            </p>
          </div>
          {confirmReset ? (
            <div
              role="group"
              aria-label="Confirm clearing local data"
              className="ml-auto flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 ring-1 ring-rose-200"
            >
              <span className="text-xs font-semibold text-rose-900">Clear transactions &amp; ledger?</span>
              <Button variant="danger" className="min-h-8 rounded-lg px-2.5 text-xs" onClick={() => void startOver()}>
                Delete
              </Button>
              <Button variant="ghost" className="min-h-8 rounded-lg px-2.5 text-xs" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="ml-auto min-h-9 rounded-xl px-3 text-xs" onClick={() => setConfirmReset(true)}>
              <RotateCcw aria-hidden className="size-3.5" /> Start over
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat
            label="Business spending"
            value={businessOutSum}
            note={plural(business.filter((t) => t.amount < 0).length, 'transaction')}
            icon={Briefcase}
            iconTone="bg-ink-50 text-ink-800 ring-ink-200/80"
          />
          <Stat
            label="Personal spending"
            value={personalOutSum}
            note={
              personalIn.length > 0
                ? `${plural(personalOut.length, 'transaction')} · +${formatMoney(sum(personalIn))} in`
                : plural(personalOut.length, 'transaction')
            }
            icon={House}
            iconTone="bg-slate-100 text-slate-600 ring-slate-200/90"
          />
          <Stat
            label="Business income"
            value={sum(business.filter((t) => t.amount > 0))}
            note={plural(business.filter((t) => t.amount > 0).length, 'payment')}
            icon={TrendingUp}
            iconTone="bg-emerald-50 text-emerald-700 ring-emerald-200/80"
            valueTone="text-emerald-800"
          />
          <Stat
            label="Not sorted yet"
            value={unsortedSum}
            note={`${review.length} to review · ${waiting.length} waiting`}
            icon={Clock}
            iconTone="bg-amber-50 text-amber-700 ring-amber-200/80"
          />
        </dl>

        {splitTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
              {businessOutSum > 0 && (
                <span
                  className="h-full bg-ink-800 transition-[width] duration-500"
                  style={{ width: `${(businessOutSum / splitTotal) * 100}%` }}
                />
              )}
              {personalOutSum > 0 && (
                <span
                  className="h-full bg-slate-400 transition-[width] duration-500"
                  style={{ width: `${(personalOutSum / splitTotal) * 100}%` }}
                />
              )}
              {unsortedSum > 0 && (
                <span
                  className="h-full bg-amber-400 transition-[width] duration-500"
                  style={{ width: `${(unsortedSum / splitTotal) * 100}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-ink-800" />
                Business {Math.round((businessOutSum / splitTotal) * 100)}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-slate-400" />
                Personal {Math.round((personalOutSum / splitTotal) * 100)}%
              </span>
              {unsortedSum > 0 && (
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                  <span aria-hidden className="size-2 rounded-full bg-amber-400" />
                  Unsorted {Math.round((unsortedSum / splitTotal) * 100)}%
                </span>
              )}
            </div>
          </div>
        )}

        <LabelingStatus waiting={waiting.length} />
      </Card>

      {review.length > 0 && filter !== 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-white px-5 py-3.5 shadow-[0_1px_2px_rgba(180,83,9,0.05)]">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/70">
              <CircleAlert aria-hidden className="size-4" />
            </span>
            <p className="text-sm leading-relaxed text-amber-950">
              <span className="font-semibold">{plural(review.length, 'transaction')} need your decision.</span> Each one takes a single click, and
              your answer is remembered for that merchant.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto min-h-9 rounded-xl" onClick={openReview}>
            Review now <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter transactions" className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-200/70 p-1 ring-1 ring-slate-200/80">
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all duration-150 ${
                filter === id
                  ? 'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${
                  id === 'review' && counts.review > 0
                    ? 'bg-amber-100 font-bold text-amber-900'
                    : filter === id
                      ? 'bg-slate-100 text-slate-700'
                      : 'text-slate-500'
                }`}
              >
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter merchant or category…"
            aria-label="Filter transactions by merchant or category"
            className="min-h-10 w-full rounded-xl border border-slate-200/90 bg-white py-1.5 pr-8 pl-9 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-ink-700 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {filter === 'review' && review.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          Tip: focus a row&apos;s toggle and press <Kbd>B</Kbd> or <Kbd>P</Kbd> — focus advances automatically to the next row.
        </p>
      )}

      <div className="relative max-w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_6px_20px_-6px_rgba(15,23,42,0.06)]">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Transactions, {FILTERS.find(([id]) => id === filter)?.[1]}</caption>
          <thead className="border-b border-slate-200/80 bg-slate-50/90 text-left text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            <tr>
              <th scope="col" className="py-3 pr-2 pl-3.5 whitespace-nowrap">
                Date
              </th>
              <th scope="col" className="px-2.5 py-3">
                Merchant
              </th>
              <th scope="col" className="px-2.5 py-3 text-right whitespace-nowrap">
                Amount
              </th>
              <th scope="col" className="px-2.5 py-3 whitespace-nowrap">
                Type
              </th>
              <th scope="col" className="py-3 pr-3.5 pl-2.5">
                Category
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((t) => (
              <Row key={t.id} tx={t} filter={filter} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            {needle ? (
              <>
                <p className="font-semibold text-slate-900">No matching transactions</p>
                <p className="text-sm text-slate-500">Nothing matched &ldquo;{query.trim()}&rdquo; in this filter.</p>
                <Button variant="ghost" className="mt-2 min-h-8 text-xs" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : filter === 'review' ? (
              <>
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <CircleCheck aria-hidden className="size-5" />
                </span>
                <p className="mt-1 font-semibold text-slate-900">Nothing left to review</p>
                <p className="text-sm text-slate-500">Every transaction has a business or personal label.</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No transactions in this view.</p>
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
  icon: Icon,
  iconTone,
  valueTone = 'text-slate-950',
}: {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  iconTone: string;
  valueTone?: string;
}) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-xl border border-slate-200/75 bg-slate-50/55 px-4 py-3.5 transition-colors hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs font-semibold text-slate-600">{label}</dt>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconTone}`}>
          <Icon aria-hidden className="size-3.5" />
        </span>
      </div>
      <dd className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${valueTone}`}>{formatMoney(shown)}</dd>
      <dd className="mt-0.5 text-xs text-slate-500">{note}</dd>
    </div>
  );
}

function Row({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const labeled = tx.source !== 'pending';
  const badge = labeled ? SOURCE_BADGE[tx.source as Exclude<Transaction['source'], 'pending'>] : undefined;
  const justArrived = tx.source === 'on-device' && recentArrivals.has(tx.id);

  return (
    <tr
      className={`align-top transition-colors hover:bg-slate-50/80 ${justArrived ? 'row-arrive' : ''} ${
        tx.needsReview ? 'bg-amber-50/25' : ''
      }`}
    >
      <td
        className={`py-3.5 pr-2 pl-3.5 whitespace-nowrap text-xs font-medium text-slate-500 tabular-nums ${
          tx.needsReview ? 'border-l-2 border-l-amber-400' : 'border-l-2 border-l-transparent'
        }`}
      >
        <time dateTime={tx.date}>{formatShortDate(tx.date)}</time>
      </td>
      <td className="px-2.5 py-3.5">
        <div className="font-semibold text-slate-900">{tx.cleanMerchant}</div>
        <div className="mt-0.5 max-w-[11rem] truncate font-mono text-[11px] text-slate-500 xl:max-w-[17rem]" title={tx.rawDescription}>
          {tx.rawDescription}
        </div>
        {tx.needsReview && tx.reviewReason && (
          <div className="mt-1.5 inline-flex items-start gap-1 rounded-md bg-amber-100/75 px-2 py-0.5 text-[11px] font-medium text-amber-950 ring-1 ring-amber-300/60">
            <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0 text-amber-700" />
            {tx.reviewReason}
          </div>
        )}
      </td>
      <td
        className={`px-2.5 py-3.5 text-right font-semibold whitespace-nowrap tabular-nums ${
          tx.amount > 0 ? 'text-emerald-700' : 'text-slate-900'
        }`}
      >
        {tx.amount > 0 ? '+' : ''}
        {formatMoney(tx.amount)}
      </td>
      <td className="px-2.5 py-3.5">
        {labeled ? (
          <TypeToggle tx={tx} filter={filter} />
        ) : (
          <>
            <span aria-hidden className="skeleton block h-8 w-32" />
            <span className="sr-only">Waiting for the on-device model</span>
          </>
        )}
      </td>
      <td className="py-3.5 pr-3.5 pl-2.5">
        {labeled ? (
          <div className="flex flex-col items-start gap-1.5">
            <select
              aria-label={`Category for ${tx.cleanMerchant}`}
              value={tx.category ?? 'Other'}
              onChange={(e) => void setCategoryByUser(tx.id, e.target.value as Category)}
              className="-mx-1.5 max-w-[9.5rem] rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-slate-800 transition-colors hover:border-slate-200 hover:bg-white focus:border-ink-700 focus:bg-white focus:outline-none xl:max-w-[12.5rem]"
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
        className={`min-h-8 rounded-md px-2.5 text-xs font-semibold transition-all duration-150 ${
          active ? activeClass : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
        }`}
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
        className={`inline-flex gap-0.5 rounded-lg p-0.5 ring-1 ring-inset ${
          tx.type === 'unsure' ? 'bg-amber-50 ring-amber-300' : 'bg-slate-100 ring-slate-200/90'
        }`}
      >
        {option('business', 'Business', 'bg-ink-800 text-white shadow-2xs')}
        {option('personal', 'Personal', 'bg-slate-700 text-white shadow-2xs')}
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
        className={`space-y-2.5 rounded-xl px-4 py-3.5 ring-1 ${
          inCloud ? 'bg-sky-50/80 ring-sky-200' : 'bg-emerald-50/80 ring-emerald-200'
        }`}
        aria-live="polite"
      >
        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${inCloud ? 'text-sky-950' : 'text-emerald-950'}`}>
          <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          <span className="font-semibold">{inCloud ? 'Labeling in the cloud, with your consent' : 'Labeling on this device'}</span>
          <span className="text-xs font-medium opacity-85 tabular-nums">
            {state.done} of {state.total} rows · batch {state.batch} of {state.batches}
          </span>
          {state.firstItemMs !== undefined && (
            <span className="text-xs font-medium opacity-80 tabular-nums">· first label after {formatSeconds(state.firstItemMs)}</span>
          )}
          {retrying && <span className="text-xs font-semibold">· cloud model is busy, retrying…</span>}
          <span className="ml-auto text-xs font-bold tabular-nums">{percent}%</span>
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
        className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200"
      >
        <CircleAlert aria-hidden className="size-4 shrink-0 text-rose-600" />
        <p className="min-w-[12rem] flex-1">Labeling stopped: {state.message}</p>
        {waiting > 0 && (
          <Button
            variant="secondary"
            className="min-h-9 rounded-lg"
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50/90 px-4 py-3 text-sm ring-1 ring-slate-200/90">
        <Cpu aria-hidden className="size-4 shrink-0 text-emerald-700" />
        <p className="min-w-[12rem] flex-1 text-slate-800">
          <strong className="font-semibold">{plural(waiting, 'row')}</strong> waiting for the on-device model.
          {!ready && <span className="text-slate-500"> On-device AI is not ready in this browser.</span>}
        </p>
        {ready ? (
          <Button variant="device" className="min-h-9 rounded-lg" onClick={() => void runOnDeviceLabeling()}>
            <Cpu aria-hidden className="size-4" /> Label on this device
          </Button>
        ) : (
          <Button variant="secondary" className="min-h-9 rounded-lg" onClick={() => navigate('welcome')}>
            Set up on-device AI
          </Button>
        )}
      </div>
    );
  }

  if (state.status === 'done') {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50/75 px-3.5 py-2.5 text-sm text-emerald-900 ring-1 ring-emerald-200/80">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-emerald-700" />
        <span>
          {state.where === 'cloud'
            ? 'Every row is labeled. The rows you agreed to share are counted in the data boundary panel.'
            : 'Every row is labeled, and raw transactions stayed on this device.'}
        </span>
        {state.firstItemMs !== undefined && (
          <span className="text-xs font-medium text-emerald-800/80 tabular-nums">First label after {formatSeconds(state.firstItemMs)}.</span>
        )}
      </p>
    );
  }

  return null;
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
        <Inbox aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">No transactions yet</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Import a CSV from your bank, or try the demo with 40 invented transactions. Either way, nothing is uploaded.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => void startDemo()}>
          <Play aria-hidden className="size-4 fill-current" /> Try with demo data
        </Button>
        <Button onClick={() => navigate('import')}>
          <FileUp aria-hidden className="size-4" /> Import your CSV
        </Button>
      </div>
    </Card>
  );
}
