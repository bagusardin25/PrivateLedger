// The finish line. Business totals, spending by category, and a CSV for the
// accountant. Everything is computed and exported in this browser; no AI is used.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Cloud,
  Cpu,
  Download,
  Inbox,
  LoaderCircle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_COLORS, CategoryDonut } from '../components/CategoryDonut';
import { PayloadViewer } from '../components/PayloadViewer';
import { Badge, Button, Card } from '../components/ui';
import { navigate } from '../lib/state/actions';
import { cloudRetryStore, friendlyCloudError } from '../lib/ai/cloudCall';
import { db, type Transaction } from '../lib/data/db';
import { deviceStore, useOnline } from '../lib/state/device';
import { cloudReady } from '../lib/ai/firebase';
import { CLOUD_MODEL } from '../lib/ai/models';
import { buildSummaryPayload, summaryPrompt, summaryStore, writePeriodSummary } from '../lib/ai/reporter';
import { useStore } from '../lib/util/store';
import { businessCsv, downloadText, exportFileName } from '../lib/data/export';
import { formatMoney, formatShortDate, formatTime, plural } from '../lib/util/format';
import { markExported, useLastExport } from '../lib/state/journey';
import { useCountUp } from '../lib/util/useCountUp';

function total(rows: Transaction[]): number {
  return rows.reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export function SummaryView() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const lastExport = useLastExport();
  const [saved, setSaved] = useState<string>();
  const [hoveredCategory, setHoveredCategory] = useState<string>();

  if (transactions === undefined) {
    return (
      <Card className="space-y-4 py-10">
        <div className="skeleton h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="skeleton h-24 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="flex flex-col items-center py-14 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-400">
          <Inbox aria-hidden className="size-5" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Nothing to summarize yet</h1>
        <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">Import a bank CSV or load the demo first.</p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('welcome')}>
          Get started
        </Button>
      </Card>
    );
  }

  const business = transactions.filter((t) => t.type === 'business').sort((a, b) => a.date.localeCompare(b.date) || a.row - b.row);
  const expenses = business.filter((t) => t.amount < 0);
  const income = business.filter((t) => t.amount > 0);
  const unsorted = transactions.filter((t) => t.needsReview || t.source === 'pending');
  const personal = transactions.filter((t) => t.type === 'personal');

  const byCategory = [
    ...expenses
      .reduce((map, t) => {
        const key = t.category ?? 'Other';
        const entry = map.get(key) ?? { category: key, amount: 0, count: 0 };
        entry.amount += Math.abs(t.amount);
        entry.count += 1;
        return map.set(key, entry);
      }, new Map<string, { category: string; amount: number; count: number }>())
      .values(),
  ].sort((a, b) => b.amount - a.amount);

  const dates = transactions.map((t) => t.date).sort();
  const period = dates.length ? `${formatShortDate(dates[0])} – ${formatShortDate(dates.at(-1)!)}` : '';
  const ready = unsorted.length === 0;
  const fileName = exportFileName(business);
  const expenseTotal = total(expenses);

  const onExport = () => {
    downloadText(fileName, businessCsv(business));
    markExported();
    setSaved(fileName);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Summary &amp; export</h1>
          {period && (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
              <Calendar aria-hidden className="size-3.5 text-zinc-400" />
              {period}
            </p>
          )}
        </div>
      </div>

      {ready ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/75 bg-white px-4 py-3.5 dark:border-emerald-500/20 dark:bg-[#111114]">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <p className="text-[13px] font-semibold text-zinc-950 dark:text-white">Every transaction is sorted. Your business list is ready.</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Totals below are computed locally in this browser from your labels.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/80 bg-white px-4 py-3 dark:border-amber-500/20 dark:bg-[#111114]">
          <div className="flex min-w-[16rem] flex-1 items-center gap-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" />
            <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-950 dark:text-white">{plural(unsorted.length, 'transaction')} not sorted yet</span> (
              {formatMoney(total(unsorted))}). They stay out of the business list until you decide.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto min-h-8 px-3 text-xs" onClick={() => navigate('review')}>
            Review now <ArrowRight aria-hidden className="size-3.5" />
          </Button>
        </div>
      )}

      {/* UNIFIED 3-COLUMN HAIRLINE KPI BAR */}
      <dl className="grid divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-[#111114]">
        <Figure label="Business spending" value={expenseTotal} note={plural(expenses.length, 'expense')} />
        <Figure label="Business income" value={total(income)} note={plural(income.length, 'payment')} positive />
        <Figure label="Net business" value={total(income) - expenseTotal} note="Income minus spending" signed />
      </dl>

      <PeriodSummaryCard rows={transactions} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Business spending by category</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {plural(expenses.length, 'expense')} · {personal.length} personal transactions excluded
            </p>
          </div>

          {byCategory.length === 0 ? (
            <p className="mt-6 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-4 py-8 text-center text-xs text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
              No business expenses yet. Mark transactions as business to see them here.
            </p>
          ) : (
            <div className="mt-6 grid items-center gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
              <CategoryDonut rows={byCategory} total={expenseTotal} active={hoveredCategory} onHover={setHoveredCategory} />
              <CategoryBars rows={byCategory} total={expenseTotal} active={hoveredCategory} onHover={setHoveredCategory} />
            </div>
          )}
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Export for your accountant</h2>
              <Badge tone="device">
                <Lock aria-hidden className="size-3" /> Local
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {plural(business.length, 'business transaction')} with date, merchant, category, and amount. Generated locally and saved straight to your
              laptop.
            </p>

            <div className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3 dark:border-white/[0.07] dark:bg-white/[0.02]">
              <p className="truncate font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200" title={fileName}>
                {fileName}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Columns: Date · Merchant · Category · Amount</p>
            </div>
          </div>

          <div className="mt-5">
            <Button variant="primary" className="min-h-10 w-full" onClick={onExport} disabled={business.length === 0}>
              <Download aria-hidden className="size-4" /> Download CSV
            </Button>
            <p className="mt-2.5 text-center text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
              {saved ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <Check aria-hidden className="size-3.5" /> Saved {saved}
                </span>
              ) : lastExport ? (
                `Last saved at ${formatTime(lastExport)}.`
              ) : (
                'Zero data uploaded during export.'
              )}
            </p>
            {!ready && (
              <p className="mt-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-center text-xs font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                {plural(unsorted.length, 'unsorted transaction')} will not be included in the file.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** The cloud writes a short summary from totals only. The exact payload is shown before and after sending. */
function PeriodSummaryCard({ rows }: { rows: Transaction[] }) {
  const state = useStore(summaryStore);
  const online = useOnline();
  const device = useStore(deviceStore);
  const { retrying } = useStore(cloudRetryStore);
  const payload = buildSummaryPayload(rows);
  const prompt = summaryPrompt(payload);
  const isDemo = rows.length > 0 && rows.every((t) => t.isDemo);
  const canRun = cloudReady && (online || device.status === 'available');
  const stale = state.result && state.sentFor !== prompt;
  const shownPayload = state.result && state.sentFor ? state.sentFor : prompt;

  const run = async () => {
    summaryStore.set({ busy: true, error: undefined });
    try {
      const result = await writePeriodSummary(payload, isDemo);
      summaryStore.set({ result, busy: false, sentFor: prompt });
    } catch (error) {
      summaryStore.set({ busy: false, error: friendlyCloudError(error, 'The summary model') });
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Monthly summary</h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Written by Gemini from category totals only. No transaction, merchant name, or date is sent.
          </p>
        </div>
        <Button variant={state.result ? 'secondary' : 'primary'} className="min-h-8.5 px-3 text-xs" onClick={() => void run()} disabled={!canRun || state.busy}>
          {state.busy ? <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden className="size-3.5" />}
          {state.busy ? (retrying ? 'Cloud is busy, trying again…' : 'Writing…') : state.result ? 'Write again' : 'Write summary'}
        </Button>
      </div>

      {state.result && (
        <div
          className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-white/[0.07] dark:bg-white/[0.02]"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state.result.source === 'in_cloud' ? 'cloud' : 'device'}>
              {state.result.source === 'in_cloud' ? <Cloud aria-hidden className="size-3" /> : <Cpu aria-hidden className="size-3" />}
              {state.result.source === 'in_cloud' ? `Cloud · ${CLOUD_MODEL}` : 'On this device · Gemini Nano'}
            </Badge>
            <span className="text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">{(state.result.ms / 1000).toFixed(1)} s</span>
            {state.result.fallback && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {state.result.fallback === 'offline' ? 'You are offline, so it was written locally.' : 'The cloud did not answer, so it was written locally.'}
              </span>
            )}
            {stale && <Badge tone="review">Labels changed since this was written</Badge>}
          </div>

          <p className="mt-3 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">{state.result.headline}</p>

          {state.result.highlights.length > 0 && (
            <ul className="mt-2.5 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
              {state.result.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                  <span className="leading-relaxed">{h}</span>
                </li>
              ))}
            </ul>
          )}

          {state.result.warnings.length > 0 && (
            <ul className="mt-3.5 space-y-1.5">
              {state.result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
                >
                  <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          {state.error}
        </p>
      )}

      {!canRun && (
        <p className="mt-4 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3.5 py-2.5 text-xs text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
          {!cloudReady
            ? 'Cloud features are not configured in this build.'
            : 'Offline, and on-device AI is not ready, so the summary cannot be written right now.'}
        </p>
      )}

      <details className="group mt-4 overflow-hidden rounded-lg border border-zinc-200/80 dark:border-white/[0.08]">
        <summary className="flex list-none items-center justify-between bg-zinc-50/70 px-3.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100/70 hover:text-zinc-950 dark:bg-white/[0.02] dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-200">
          <span>{state.result ? 'Inspect exactly what was sent' : 'Inspect exactly what will be sent'}</span>
          <ChevronDown aria-hidden className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
        </summary>
        <PayloadViewer
          title="Totals-only prompt payload"
          content={shownPayload}
          accent="cloud"
          maxHeightClass="max-h-60"
          className="rounded-none border-0 border-t border-zinc-800"
        />
      </details>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
  signed = false,
  positive = false,
}: {
  label: string;
  value: number;
  note: string;
  signed?: boolean;
  positive?: boolean;
}) {
  const shown = useCountUp(value);
  const text = signed && value > 0 ? `+${formatMoney(shown)}` : formatMoney(shown);
  return (
    <div className="px-5 py-4">
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.65rem] ${
          positive ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-950 dark:text-white'
        }`}
      >
        {text}
      </dd>
      <dd className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{note}</dd>
    </div>
  );
}

/** Ranked horizontal bars synced with the donut chart via hover/focus state. */
function CategoryBars({
  rows,
  total,
  active,
  onHover,
}: {
  rows: { category: string; amount: number; count: number }[];
  total: number;
  active?: string;
  onHover: (category?: string) => void;
}) {
  const max = rows[0]?.amount ?? 1;
  return (
    <ol className="space-y-1.5" aria-label="Business spending by category, largest first">
      {rows.map((row, index) => {
        const share = total ? Math.round((row.amount / total) * 100) : 0;
        const width = Math.max(4, (row.amount / max) * 100);
        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
        const isActive = active === row.category;
        const isDimmed = Boolean(active && !isActive);

        return (
          <li key={row.category} className="group relative">
            <div
              tabIndex={0}
              onMouseEnter={() => onHover(row.category)}
              onMouseLeave={() => onHover(undefined)}
              onFocus={() => onHover(row.category)}
              onBlur={() => onHover(undefined)}
              aria-label={`${row.category}: ${formatMoney(row.amount)}, ${plural(row.count, 'transaction')}, ${share}% of business spending`}
              className={`rounded-lg px-2.5 py-2 transition-colors duration-150 ${
                isActive ? 'bg-zinc-100/90 dark:bg-white/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
              } ${isDimmed ? 'opacity-45' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate">{row.category}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2.5 tabular-nums">
                  <span className="font-semibold text-zinc-950 dark:text-white">{formatMoney(row.amount)}</span>
                  <span className="w-7 text-right text-zinc-500 dark:text-zinc-400">{share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${width}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
