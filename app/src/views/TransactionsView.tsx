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
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Transactions</h1>
              {hasDemo && <Badge tone="neutral">Demo data</Badge>}
            </div>
            <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400" title={fileNames}>
              {plural(counts.all, 'transaction')}
              {fileNames && ` from ${fileNames}`}
            </p>
          </div>
          {confirmReset ? (
            <div
              role="group"
              aria-label="Confirm clearing local data"
              className="ml-auto flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-3 py-1.5 ring-1 ring-rose-200 dark:bg-rose-950/70 dark:ring-rose-800"
            >
              <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">Clear transactions &amp; ledger?</span>
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
            iconTone="bg-ink-50 text-ink-800 ring-ink-200/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-700/60"
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
            iconTone="bg-stone-100 text-zinc-600 ring-stone-200/90 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-white/10"
          />
          <Stat
            label="Business income"
            value={sum(business.filter((t) => t.amount > 0))}
            note={plural(business.filter((t) => t.amount > 0).length, 'payment')}
            icon={TrendingUp}
            iconTone="bg-teal-50 text-teal-800 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60"
            valueTone="text-teal-800 dark:text-teal-400"
          />
          <Stat
            label="Not sorted yet"
            value={unsortedSum}
            note={`${review.length} to review · ${waiting.length} waiting`}
            icon={Clock}
            iconTone="bg-amber-50 text-amber-800 ring-amber-200/85 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-700/60"
          />
        </dl>

        {splitTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-white/[0.06]" aria-hidden>
              {businessOutSum > 0 && (
                <span
                  className="h-full bg-ink-800 transition-[width] duration-500 dark:bg-indigo-400"
                  style={{ width: `${(businessOutSum / splitTotal) * 100}%` }}
                />
              )}
              {personalOutSum > 0 && (
                <span
                  className="h-full bg-stone-400 transition-[width] duration-500 dark:bg-zinc-500"
                  style={{ width: `${(personalOutSum / splitTotal) * 100}%` }}
                />
              )}
              {unsortedSum > 0 && (
                <span
                  className="h-full bg-amber-400 transition-[width] duration-500 dark:bg-amber-500"
                  style={{ width: `${(unsortedSum / splitTotal) * 100}%` }}
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-ink-800 dark:bg-indigo-400" />
                Business {Math.round((businessOutSum / splitTotal) * 100)}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-stone-400 dark:bg-zinc-500" />
                Personal {Math.round((personalOutSum / splitTotal) * 100)}%
              </span>
              {unsortedSum > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                  <span aria-hidden className="size-2 rounded-full bg-amber-400 dark:bg-amber-500" />
                  Unsorted {Math.round((unsortedSum / splitTotal) * 100)}%
                </span>
              )}
            </div>
          </div>
        )}

        <LabelingStatus waiting={waiting.length} />
      </Card>

      {review.length > 0 && filter !== 'review' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-white px-5 py-3.5 shadow-[0_1px_2px_rgba(180,83,9,0.05)] dark:border-amber-800/50 dark:from-amber-950/45 dark:via-amber-950/15 dark:to-[#12131c]">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/70 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-700/70">
              <CircleAlert aria-hidden className="size-4" />
            </span>
            <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100">
              <span className="font-bold">{plural(review.length, 'transaction')} need your decision.</span> Each one takes a single click, and your
              answer is remembered for that merchant.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto min-h-9 rounded-xl" onClick={openReview}>
            Review now <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter transactions"
          className="inline-flex flex-wrap gap-1 rounded-xl bg-stone-200/70 p-1 ring-1 ring-stone-200/90 dark:bg-white/[0.04] dark:ring-white/[0.08]"
        >
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all duration-150 ${
                filter === id
                  ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(24,24,27,0.08)] ring-1 ring-stone-900/5 dark:bg-white/[0.1] dark:text-white dark:ring-white/10'
                  : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
              }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${
                  id === 'review' && counts.review > 0
                    ? 'bg-amber-100 font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                    : filter === id
                      ? 'bg-stone-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200'
                      : 'text-zinc-500'
                }`}
              >
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter merchant or category…"
            aria-label="Filter transactions by merchant or category"
            className="min-h-10 w-full rounded-xl border border-stone-200/95 bg-white py-1.5 pr-8 pl-9 text-sm text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-colors placeholder:text-zinc-400 hover:border-stone-300 focus:border-ink-700 focus:outline-none dark:border-white/[0.09] dark:bg-[#12131c] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-white/20 dark:focus:border-indigo-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-stone-100 hover:text-zinc-800 dark:hover:bg-white/10 dark:hover:text-white"
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

      <div className="relative max-w-full overflow-x-auto rounded-2xl border border-stone-200/85 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03),0_8px_24px_-8px_rgba(24,24,27,0.06)] dark:border-white/[0.08] dark:bg-[#12131c]">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">Transactions, {FILTERS.find(([id]) => id === filter)?.[1]}</caption>
          <thead className="border-b border-stone-200/80 bg-stone-50/90 text-left text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-400">
            <tr>
              <th scope="col" className="py-3 pr-2 pl-3.5 whitespace-nowrap">
                Date
              </th>
              <th scope="col" className="px-2 py-3 xl:px-2.5">
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
          <tbody className="divide-y divide-stone-100 dark:divide-white/[0.06]">
            {visible.map((t) => (
              <Row key={t.id} tx={t} filter={filter} />
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            {needle ? (
              <>
                <p className="font-semibold text-zinc-900 dark:text-white">No matching transactions</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing matched &ldquo;{query.trim()}&rdquo; in this filter.</p>
                <Button variant="ghost" className="mt-2 min-h-8 text-xs" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </>
            ) : filter === 'review' ? (
              <>
                <span className="flex size-10 items-center justify-center rounded-full bg-teal-50 text-teal-800 ring-1 ring-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:ring-teal-800">
                  <CircleCheck aria-hidden className="size-5" />
                </span>
                <p className="mt-1 font-semibold text-zinc-900 dark:text-white">Nothing left to review</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Every transaction has a business or personal label.</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No transactions in this view.</p>
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
  valueTone = 'text-zinc-950 dark:text-white',
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
    <div className="rounded-xl border border-stone-200/85 bg-stone-50/65 px-4 py-3.5 transition-colors hover:bg-stone-50 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{label}</dt>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${iconTone}`}>
          <Icon aria-hidden className="size-3.5" />
        </span>
      </div>
      <dd className={`mt-2 text-2xl font-extrabold tracking-tight tabular-nums ${valueTone}`}>{formatMoney(shown)}</dd>
      <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{note}</dd>
    </div>
  );
}

function Row({ tx, filter }: { tx: Transaction; filter: Filter }) {
  const labeled = tx.source !== 'pending';
  const badge = labeled ? SOURCE_BADGE[tx.source as Exclude<Transaction['source'], 'pending'>] : undefined;
  const justArrived = tx.source === 'on-device' && recentArrivals.has(tx.id);

  return (
    <tr
      className={`align-top transition-colors hover:bg-stone-50/85 dark:hover:bg-white/[0.03] ${justArrived ? 'row-arrive' : ''} ${
        tx.needsReview ? 'bg-amber-50/30 dark:bg-amber-950/15' : ''
      }`}
    >
      <td
        className={`py-3.5 pr-2 pl-3.5 whitespace-nowrap text-xs font-medium text-zinc-500 tabular-nums dark:text-zinc-400 ${
          tx.needsReview ? 'border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'
        }`}
      >
        <time dateTime={tx.date}>{formatShortDate(tx.date)}</time>
      </td>
      <td className="px-2 py-3.5 xl:px-2.5">
        <div className="flex items-start gap-2">
          <MerchantAvatar name={tx.cleanMerchant} size="sm" className="mt-0.5 hidden xl:inline-flex" />
          <div className="min-w-0">
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{tx.cleanMerchant}</div>
            <div className="mt-0.5 max-w-[9rem] truncate font-mono text-[11px] text-zinc-500 xl:max-w-[15rem] dark:text-zinc-400" title={tx.rawDescription}>
              {tx.rawDescription}
            </div>
            {tx.needsReview && tx.reviewReason && (
              <div className="mt-1.5 inline-flex items-start gap-1 rounded-md bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-950 ring-1 ring-amber-300/60 dark:bg-amber-950/80 dark:text-amber-200 dark:ring-amber-700/60">
                <CircleAlert aria-hidden className="mt-0.5 size-3 shrink-0 text-amber-700 dark:text-amber-400" />
                {tx.reviewReason}
              </div>
            )}
          </div>
        </div>
      </td>
      <td
        className={`px-2.5 py-3.5 text-right font-bold whitespace-nowrap tabular-nums ${
          tx.amount > 0 ? 'text-teal-700 dark:text-teal-400' : 'text-zinc-900 dark:text-zinc-100'
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
              className="-mx-1.5 max-w-[9.5rem] rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-[13px] font-medium text-zinc-800 transition-colors hover:border-stone-200 hover:bg-white focus:border-ink-700 focus:bg-white focus:outline-none xl:max-w-[12.5rem] dark:text-zinc-200 dark:hover:border-white/15 dark:hover:bg-zinc-900 dark:focus:border-indigo-400 dark:focus:bg-zinc-900"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-white text-zinc-900 dark:bg-[#12131c] dark:text-zinc-100">
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
          active ? activeClass : 'text-zinc-600 hover:bg-white/80 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white'
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
          tx.type === 'unsure'
            ? 'bg-amber-50 ring-amber-300 dark:bg-amber-950/50 dark:ring-amber-700'
            : 'bg-stone-100 ring-stone-200/90 dark:bg-white/[0.05] dark:ring-white/10'
        }`}
      >
        {option('business', 'Business', 'bg-ink-800 text-white shadow-2xs dark:bg-indigo-400 dark:text-zinc-950')}
        {option('personal', 'Personal', 'bg-zinc-700 text-white shadow-2xs dark:bg-zinc-500 dark:text-white')}
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
          inCloud
            ? 'bg-indigo-50/80 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800'
            : 'bg-teal-50/80 ring-teal-200 dark:bg-teal-950/40 dark:ring-teal-800'
        }`}
        aria-live="polite"
      >
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${
            inCloud ? 'text-indigo-950 dark:text-indigo-100' : 'text-teal-950 dark:text-teal-100'
          }`}
        >
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
        className="flex flex-wrap items-center gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800"
      >
        <CircleAlert aria-hidden className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
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
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-stone-50/90 px-4 py-3 text-sm ring-1 ring-stone-200/90 dark:bg-white/[0.04] dark:ring-white/10">
        <Cpu aria-hidden className="size-4 shrink-0 text-teal-700 dark:text-teal-400" />
        <p className="min-w-[12rem] flex-1 text-zinc-800 dark:text-zinc-200">
          <strong className="font-semibold">{plural(waiting, 'row')}</strong> waiting for the on-device model.
          {!ready && <span className="text-zinc-500 dark:text-zinc-400"> On-device AI is not ready in this browser.</span>}
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
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-teal-50/75 px-3.5 py-2.5 text-sm text-teal-950 ring-1 ring-teal-200/80 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/60">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-teal-700 dark:text-teal-400" />
        <span>
          {state.where === 'cloud'
            ? 'Every row is labeled. The rows you agreed to share are counted in the data boundary panel.'
            : 'Every row is labeled, and raw transactions stayed on this device.'}
        </span>
        {state.firstItemMs !== undefined && (
          <span className="text-xs font-medium text-teal-800/80 tabular-nums dark:text-teal-300/80">
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
    <Card className="flex flex-col items-center p-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-zinc-600 ring-1 ring-stone-200/85 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-white/10">
        <Inbox aria-hidden className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">No transactions yet</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
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
