// F5: the finish line. Business totals, spending by category, and a CSV for the
// accountant. Everything is computed and exported in this browser; no AI is used.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, CircleAlert, CircleCheck, Download, FileCheck2, Inbox } from 'lucide-react';
import { useState } from 'react';
import { Button, Card } from '../components/ui';
import { navigate } from '../lib/actions';
import { db, type Transaction } from '../lib/db';
import { businessCsv, downloadText, exportFileName } from '../lib/export';
import { formatMoney, formatShortDate, formatTime, plural } from '../lib/format';
import { markExported, useLastExport } from '../lib/journey';
import { useCountUp } from '../lib/useCountUp';

function total(rows: Transaction[]): number {
  return rows.reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

export function SummaryView() {
  const transactions = useLiveQuery(() => db.transactions.toArray(), []);
  const lastExport = useLastExport();
  const [saved, setSaved] = useState<string>();

  if (transactions === undefined) return <Card>Loading…</Card>;
  if (transactions.length === 0) {
    return (
      <Card className="flex flex-col items-center p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
          <Inbox aria-hidden className="size-6 text-slate-600" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Nothing to summarize yet</h1>
        <p className="mt-2 max-w-md text-sm text-slate-700">Import a bank CSV or load the demo first.</p>
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

  const byCategory = [...expenses.reduce((map, t) => {
    const key = t.category ?? 'Other';
    const entry = map.get(key) ?? { category: key, amount: 0, count: 0 };
    entry.amount += Math.abs(t.amount);
    entry.count += 1;
    return map.set(key, entry);
  }, new Map<string, { category: string; amount: number; count: number }>()).values()].sort((a, b) => b.amount - a.amount);

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
          <p className="text-sm font-medium text-slate-600">{period}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Summary &amp; export</h1>
        </div>
      </div>

      {ready ? (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-5 py-4 ring-1 ring-emerald-200">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <div>
            <p className="font-semibold text-emerald-900">Every transaction is sorted. Your business list is ready.</p>
            <p className="text-sm text-emerald-900/80">Totals below are computed in this browser from your labels.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
          <div className="flex min-w-[16rem] flex-1 items-start gap-3">
            <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{plural(unsorted.length, 'transaction')} not sorted yet</span> ({formatMoney(total(unsorted))}). They stay out of
              the business list until you decide.
            </p>
          </div>
          <Button variant="secondary" className="ml-auto" onClick={() => navigate('review')}>
            Review now <ArrowRight aria-hidden className="size-4" />
          </Button>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Figure label="Business spending" value={total(expenses)} note={plural(expenses.length, 'expense')} emphasis />
        <Figure label="Business income" value={total(income)} note={plural(income.length, 'payment')} />
        <Figure label="Net business" value={total(income) - total(expenses)} note="Income minus spending" signed />
      </dl>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <h2 className="font-semibold">Business spending by category</h2>
          <p className="text-sm text-slate-600">
            {plural(expenses.length, 'expense')} · {personal.length} personal transactions left out
          </p>
          {byCategory.length === 0 ? (
            <p className="mt-6 text-sm text-slate-600">No business expenses yet. Mark transactions as business to see them here.</p>
          ) : (
            <CategoryBars rows={byCategory} total={total(expenses)} />
          )}
        </Card>

        <Card className="flex flex-col">
          <span className="flex size-10 items-center justify-center rounded-lg bg-ink-50 text-ink-800">
            <FileCheck2 aria-hidden className="size-5" />
          </span>
          <h2 className="mt-3 font-semibold">Export for your accountant</h2>
          <p className="mt-1 text-sm text-slate-700">
            {plural(business.length, 'business transaction')} with date, merchant, category, and amount. Built in this browser and saved to your
            computer. Nothing is uploaded.
          </p>
          <Button variant="primary" className="mt-5" onClick={onExport} disabled={business.length === 0}>
            <Download aria-hidden className="size-4" /> Download CSV
          </Button>
          <p className="mt-2 text-xs text-slate-600" aria-live="polite">
            {saved ? (
              <span className="font-medium text-emerald-800">Saved {saved}.</span>
            ) : lastExport ? (
              `Last saved at ${formatTime(lastExport)}.`
            ) : (
              fileName
            )}
          </p>
          {!ready && <p className="mt-3 text-xs text-amber-900">{plural(unsorted.length, 'unsorted transaction')} will not be in the file.</p>}
        </Card>
      </div>
    </div>
  );
}

function Figure({ label, value, note, emphasis = false, signed = false }: { label: string; value: number; note: string; emphasis?: boolean; signed?: boolean }) {
  const shown = useCountUp(value);
  const text = signed && value > 0 ? `+${formatMoney(shown)}` : formatMoney(shown);
  return (
    <div className={`rounded-xl px-5 py-4 shadow-sm ring-1 ${emphasis ? 'bg-ink-800 text-white ring-ink-800' : 'bg-white ring-slate-900/5'}`}>
      <dt className={`text-sm font-medium ${emphasis ? 'text-ink-100' : 'text-slate-600'}`}>{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{text}</dd>
      <dd className={`mt-0.5 text-sm ${emphasis ? 'text-ink-100' : 'text-slate-600'}`}>{note}</dd>
    </div>
  );
}

/** Ranked horizontal bars, one hue (single series), value printed beside each bar. */
function CategoryBars({ rows, total }: { rows: { category: string; amount: number; count: number }[]; total: number }) {
  const max = rows[0]?.amount ?? 1;
  return (
    <ol className="mt-5 space-y-3" aria-label="Business spending by category, largest first">
      {rows.map((row) => {
        const share = total ? Math.round((row.amount / total) * 100) : 0;
        return (
          <li key={row.category} className="group relative">
            <div
              tabIndex={0}
              aria-label={`${row.category}: ${formatMoney(row.amount)}, ${plural(row.count, 'transaction')}, ${share}% of business spending`}
              className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-0.5 focus-visible:bg-slate-50 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto]"
            >
              <span className="truncate text-sm text-slate-800">{row.category}</span>
              <span className="h-2.5 rounded-r-[4px] bg-ink-700 transition-[width] duration-500" style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }} />
              <span className="text-sm font-medium text-slate-900 tabular-nums">{formatMoney(row.amount)}</span>
            </div>
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow group-focus-within:block group-hover:block"
            >
              {plural(row.count, 'transaction')} · {share}% of business spending
            </span>
          </li>
        );
      })}
    </ol>
  );
}
