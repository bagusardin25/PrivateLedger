// The finish line. Business totals, spending by category, and a CSV for the
// accountant. Everything is computed and exported in this browser; no AI is used.

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Cloud,
  Cpu,
  Download,
  FileCheck2,
  Inbox,
  LoaderCircle,
  Lock,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CopyButton } from '../components/ui';
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

  if (transactions === undefined) {
    return (
      <Card className="space-y-4 py-10">
        <div className="skeleton h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="flex flex-col items-center p-12 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200/80">
          <Inbox aria-hidden className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-950">Nothing to summarize yet</h1>
        <p className="mt-2 max-w-md text-sm text-slate-600">Import a bank CSV or load the demo first.</p>
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

  const onExport = () => {
    downloadText(fileName, businessCsv(business));
    markExported();
    setSaved(fileName);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {period && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-2xs ring-1 ring-slate-200/80">
              <Calendar aria-hidden className="size-3.5 text-ink-700" />
              {period}
            </p>
          )}
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Summary &amp; export</h1>
        </div>
      </div>

      {ready ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-emerald-50/50 to-white px-5 py-4 shadow-[0_1px_2px_rgba(6,78,59,0.05)]">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/70">
            <CircleCheck aria-hidden className="size-4" />
          </span>
          <div>
            <p className="font-semibold text-emerald-950">Every transaction is sorted. Your business list is ready.</p>
            <p className="mt-0.5 text-sm text-emerald-900/80">Totals below are computed locally in this browser from your labels.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-amber-50/55 to-white px-5 py-4 shadow-[0_1px_2px_rgba(180,83,9,0.05)]">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/70">
              <CircleAlert aria-hidden className="size-4" />
            </span>
            <p className="text-sm leading-relaxed text-amber-950">
              <span className="font-semibold">{plural(unsorted.length, 'transaction')} not sorted yet</span> ({formatMoney(total(unsorted))}). They stay out of
              the business list until you decide.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto rounded-xl" onClick={() => navigate('review')}>
            Review now <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Figure label="Business spending" value={total(expenses)} note={plural(expenses.length, 'expense')} icon={Briefcase} emphasis />
        <Figure label="Business income" value={total(income)} note={plural(income.length, 'payment')} icon={TrendingUp} positive />
        <Figure label="Net business" value={total(income) - total(expenses)} note="Income minus spending" icon={Wallet} signed />
      </dl>

      <PeriodSummaryCard rows={transactions} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-950">Business spending by category</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {plural(expenses.length, 'expense')} · {personal.length} personal transactions excluded
              </p>
            </div>
          </div>
          {byCategory.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
              No business expenses yet. Mark transactions as business to see them here.
            </p>
          ) : (
            <CategoryBars rows={byCategory} total={total(expenses)} />
          )}
        </Card>

        <Card className="flex flex-col justify-between bg-gradient-to-b from-white to-slate-50/60">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex size-11 items-center justify-center rounded-xl bg-ink-50 text-ink-800 ring-1 ring-ink-200/80">
                <FileCheck2 aria-hidden className="size-5" />
              </span>
              <Badge tone="device">
                <Lock aria-hidden className="size-3" /> Local export
              </Badge>
            </div>
            <h2 className="mt-4 text-base font-semibold tracking-tight text-slate-950">Export for your accountant</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {plural(business.length, 'business transaction')} with date, merchant, category, and amount. Built right in this browser and saved straight to
              your laptop.
            </p>

            <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-200/80">
              <p className="truncate font-mono text-xs font-semibold text-slate-800" title={fileName}>
                {fileName}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Columns: Date · Merchant · Category · Amount</p>
            </div>
          </div>

          <div className="mt-5">
            <Button variant="primary" className="min-h-11 w-full" onClick={onExport} disabled={business.length === 0}>
              <Download aria-hidden className="size-4" /> Download CSV
            </Button>
            <p className="mt-2.5 text-center text-xs text-slate-500" aria-live="polite">
              {saved ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <Check aria-hidden className="size-3.5" /> Saved {saved}
                </span>
              ) : lastExport ? (
                `Last saved at ${formatTime(lastExport)}.`
              ) : (
                'Zero data uploaded during export.'
              )}
            </p>
            {!ready && (
              <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900 ring-1 ring-amber-200/80">
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
    <Card className="relative overflow-hidden">
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 ${
          state.result?.source === 'on_device'
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
            : 'bg-gradient-to-r from-sky-500 via-ink-600 to-sky-400'
        }`}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200/80">
            <Sparkles aria-hidden className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-950">Monthly summary</h2>
            <p className="text-sm text-slate-500">Written by Gemini from category totals only. No transaction, merchant name, or date is sent.</p>
          </div>
        </div>
        <Button variant={state.result ? 'secondary' : 'primary'} onClick={() => void run()} disabled={!canRun || state.busy}>
          {state.busy ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Sparkles aria-hidden className="size-4" />}
          {state.busy ? (retrying ? 'Cloud is busy, trying again…' : 'Writing…') : state.result ? 'Write again' : 'Write summary'}
        </Button>
      </div>

      {state.result && (
        <div
          className="mt-5 rounded-xl border border-slate-200/85 bg-gradient-to-b from-slate-50/90 to-white p-5"
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={state.result.source === 'in_cloud' ? 'cloud' : 'device'}>
              {state.result.source === 'in_cloud' ? <Cloud aria-hidden className="size-3" /> : <Cpu aria-hidden className="size-3" />}
              {state.result.source === 'in_cloud' ? `Cloud · ${CLOUD_MODEL}` : 'On this device · Gemini Nano'}
            </Badge>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 tabular-nums ring-1 ring-slate-200/80">
              {(state.result.ms / 1000).toFixed(1)} s
            </span>
            {state.result.fallback && (
              <span className="text-xs text-slate-500">
                {state.result.fallback === 'offline' ? 'You are offline, so it was written locally.' : 'The cloud did not answer, so it was written locally.'}
              </span>
            )}
            {stale && <Badge tone="review">Labels changed since this was written</Badge>}
          </div>

          <p className="mt-3.5 text-lg font-bold tracking-tight text-slate-950">{state.result.headline}</p>

          {state.result.highlights.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {state.result.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5">
                  <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <Check aria-hidden className="size-2.5" strokeWidth={3} />
                  </span>
                  <span className="leading-relaxed">{h}</span>
                </li>
              ))}
            </ul>
          )}

          {state.result.warnings.length > 0 && (
            <ul className="mt-4 space-y-2">
              {state.result.warnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 rounded-xl bg-amber-50/90 px-3.5 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200/80"
                >
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200">
          {state.error}
        </p>
      )}

      {!canRun && (
        <p className="mt-4 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-slate-200/80">
          {!cloudReady
            ? 'Cloud features are not configured in this build.'
            : 'Offline, and on-device AI is not ready, so the summary cannot be written right now.'}
        </p>
      )}

      <details className="group mt-4 overflow-hidden rounded-xl ring-1 ring-slate-200/90">
        <summary className="flex list-none items-center justify-between bg-slate-50/90 px-3.5 py-2.5 text-xs font-semibold text-sky-900 transition-colors hover:bg-slate-100/80">
          <span>{state.result ? 'Inspect exactly what was sent' : 'Inspect exactly what will be sent'}</span>
          <ChevronDown aria-hidden className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-3.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>Totals-only prompt payload</span>
            <CopyButton text={shownPayload} label="Copy" dark />
          </div>
          <pre className="code-inspector max-h-64 overflow-auto p-3.5 font-mono text-xs leading-relaxed">
            {shownPayload}
          </pre>
        </div>
      </details>
    </Card>
  );
}

function Figure({
  label,
  value,
  note,
  icon: Icon,
  emphasis = false,
  signed = false,
  positive = false,
}: {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  emphasis?: boolean;
  signed?: boolean;
  positive?: boolean;
}) {
  const shown = useCountUp(value);
  const text = signed && value > 0 ? `+${formatMoney(shown)}` : formatMoney(shown);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl px-5 py-5 ${
        emphasis
          ? 'bg-gradient-to-br from-ink-800 via-ink-900 to-ink-950 text-white shadow-[0_8px_28px_-8px_rgba(16,36,64,0.5)] ring-1 ring-ink-700/60'
          : 'border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_6px_20px_-6px_rgba(15,23,42,0.06)]'
      }`}
    >
      {emphasis && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-sky-400/15 blur-2xl"
        />
      )}
      <div className="relative flex items-center justify-between gap-2">
        <dt className={`text-xs font-semibold tracking-wide ${emphasis ? 'text-ink-100' : 'text-slate-500'}`}>{label}</dt>
        <span
          className={`flex size-8 items-center justify-center rounded-xl ${
            emphasis
              ? 'bg-white/10 text-white ring-1 ring-white/15'
              : positive
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
          }`}
        >
          <Icon aria-hidden className="size-4" />
        </span>
      </div>
      <dd
        className={`relative mt-2.5 text-3xl font-bold tracking-tight tabular-nums ${
          emphasis ? 'text-white' : positive ? 'text-emerald-800' : 'text-slate-950'
        }`}
      >
        {text}
      </dd>
      <dd className={`relative mt-1 text-xs ${emphasis ? 'text-ink-200' : 'text-slate-500'}`}>{note}</dd>
    </div>
  );
}

/** Ranked horizontal bars, one hue (single series), value printed beside each bar. */
function CategoryBars({ rows, total }: { rows: { category: string; amount: number; count: number }[]; total: number }) {
  const max = rows[0]?.amount ?? 1;
  return (
    <ol className="mt-5 space-y-2.5" aria-label="Business spending by category, largest first">
      {rows.map((row) => {
        const share = total ? Math.round((row.amount / total) * 100) : 0;
        const width = Math.max(3, (row.amount / max) * 100);
        return (
          <li key={row.category} className="group relative">
            <div
              tabIndex={0}
              aria-label={`${row.category}: ${formatMoney(row.amount)}, ${plural(row.count, 'transaction')}, ${share}% of business spending`}
              className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 sm:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)_auto]"
            >
              <span className="truncate text-sm font-medium text-slate-800">{row.category}</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-ink-800 to-ink-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${width}%` }}
                />
              </div>
              <div className="flex items-baseline gap-2 text-right tabular-nums">
                <span className="text-sm font-semibold text-slate-900">{formatMoney(row.amount)}</span>
                <span className="w-8 text-xs font-medium text-slate-400">{share}%</span>
              </div>
            </div>
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-lg group-focus-within:block group-hover:block"
            >
              {plural(row.count, 'transaction')} · {share}% of business spending
            </span>
          </li>
        );
      })}
    </ol>
  );
}
