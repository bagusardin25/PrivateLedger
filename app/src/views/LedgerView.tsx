// Privacy Ledger: every AI call the app made, with the exact payload of each
// cloud request. The counters are computed from these entries and are the same
// numbers the Data Boundary panel shows.

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Download, Inbox, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { PayloadViewer } from '../components/PayloadViewer';
import { SOURCE_META } from '../components/sourceMeta';
import { Badge, Button, Card } from '../components/ui';
import { navigate } from '../lib/state/actions';
import { db, type LedgerEntry, type LedgerSource } from '../lib/data/db';
import { downloadText } from '../lib/data/export';
import { formatBytes, formatDateTime, formatSeconds, plural } from '../lib/util/format';
import { countLedger } from '../lib/data/ledger';

type Filter = 'all' | LedgerSource;

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['in_cloud', 'Sent to cloud'],
  ['on_device', 'On this device'],
  ['blocked', 'Blocked'],
  ['refused', 'Not sent'],
];

/** Why each feature runs where it does: the mode follows the sensitivity of the data. */
const MODES = [
  { feature: 'Labeling', mode: 'ONLY_ON_DEVICE', data: 'Raw bank rows and your business profile', where: 'Never leaves this device' },
  { feature: 'Message guard', mode: 'ONLY_ON_DEVICE', data: 'Your chat message, before it is sent', where: 'Checked here first' },
  { feature: 'Explain merchant', mode: 'PREFER_ON_DEVICE', data: 'One merchant name', where: 'Here; the cloud only if you agree' },
  { feature: 'Monthly summary', mode: 'PREFER_IN_CLOUD', data: 'Totals per category for one month', where: 'Cloud; Gemini Nano if the cloud cannot answer' },
  { feature: 'Advisor', mode: 'ONLY_IN_CLOUD', data: 'Your question and totals from local functions', where: 'Cloud, which never sees a transaction' },
  { feature: 'Cloud labeling (consent)', mode: 'ONLY_IN_CLOUD', data: 'One bank description per merchant', where: 'Cloud, only after you agree' },
];

export function LedgerView() {
  const entries = useLiveQuery(() => db.ledgerEntries.orderBy('timestamp').reverse().toArray(), []);
  const [filter, setFilter] = useState<Filter>('all');

  if (entries === undefined) {
    return (
      <Card className="space-y-4 py-10">
        <div className="skeleton h-6 w-40" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  const counters = countLedger(entries);
  const count = (id: Filter) => (id === 'all' ? entries.length : entries.filter((e) => e.inferenceSource === id).length);
  const visible = filter === 'all' ? entries : entries.filter((e) => e.inferenceSource === filter);
  const nothingSent = counters.rawSentUser === 0;

  const exportJson = () => {
    const body = { exportedAt: new Date().toISOString(), counters, entries: [...entries].reverse() };
    downloadText(`privacy-ledger-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(body, null, 2), 'application/json');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Privacy Ledger</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            Every AI call this app made, and the exact payload of each request that left this device. All counters are computed directly from these records.
          </p>
        </div>
        <Button variant="secondary" className="min-h-8.5 px-3 text-xs" onClick={exportJson} disabled={entries.length === 0}>
          <Download aria-hidden className="size-3.5" /> Export ledger JSON
        </Button>
      </div>

      {/* UNIFIED FORENSIC TELEMETRY STRIP */}
      <dl className="grid grid-cols-2 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white md:grid-cols-4 xl:grid-cols-6 xl:divide-x xl:divide-y-0 dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-[#111114]">
        <div className="col-span-2 px-5 py-4 md:col-span-4 xl:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <ShieldCheck aria-hidden className={`size-3.5 ${nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
            Raw transactions sent to cloud
          </dt>
          <dd
            className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${
              nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
            }`}
          >
            {counters.rawSentUser}
          </dd>
          <dd className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            {counters.rawSentDemo > 0 ? `Your own data · +${plural(counters.rawSentDemo, 'demo row')} with consent` : 'Your own data · verified from ledger'}
          </dd>
        </div>
        <Counter label="Merchant names shared" value={counters.merchantNamesShared} className="border-r border-zinc-100 md:border-r xl:border-r-0 dark:border-white/[0.06]" />
        <Counter label="Cloud requests" value={counters.cloudRequests} className="md:border-r md:border-zinc-100 xl:border-r-0 md:dark:border-white/[0.06]" />
        <Counter label="On-device AI calls" value={counters.onDeviceCalls} tone="text-emerald-700 dark:text-emerald-400" className="border-r border-zinc-100 md:border-r xl:border-r-0 dark:border-white/[0.06]" />
        <Counter label="Messages blocked" value={counters.blockedMessages} tone={counters.blockedMessages > 0 ? 'text-rose-700 dark:text-rose-400' : undefined} />
      </dl>

      <div
        role="group"
        aria-label="Filter ledger entries"
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
            <span className={`text-[11px] tabular-nums ${filter === id ? 'opacity-75' : 'text-zinc-500 dark:text-zinc-400'}`}>{count(id)}</span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-400">
            <Inbox aria-hidden className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">No AI calls yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Label some transactions, write a summary, or ask the advisor. Each call appears here as it happens.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('transactions')}>
            Go to transactions
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-10 text-center text-xs text-zinc-500 dark:text-zinc-400">No entries of this kind.</Card>
      ) : (
        <ol className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:divide-white/[0.06] dark:border-white/[0.08] dark:bg-[#111114]" aria-label="Ledger entries, newest first">
          {visible.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      <Card>
        <h2 className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">Why each feature runs where it does</h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          The inference mode follows how sensitive the data is. Each row is its own Firebase AI Logic model instance.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200/80 dark:border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-zinc-200/80 bg-zinc-50/70 text-[11px] font-medium text-zinc-500 dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Feature
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Inference mode
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Data it is given
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Where it runs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white dark:divide-white/[0.05] dark:bg-[#111114]">
              {MODES.map((row) => (
                <tr key={row.feature} className="hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]">
                  <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap text-zinc-950 dark:text-zinc-100">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3">
                    <ModeChip mode={row.mode} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.data}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Counter({ label, value, tone = 'text-zinc-950 dark:text-white', className = '' }: { label: string; value: number; tone?: string; className?: string }) {
  return (
    <div className={`px-4 py-4 ${className}`}>
      <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const onDevice = mode.includes('ON_DEVICE');
  return (
    <code
      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap ${
        onDevice
          ? 'border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'border-indigo-200/70 bg-indigo-50 text-indigo-800 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300'
      }`}
    >
      {mode}
    </code>
  );
}

function Entry({ entry }: { entry: LedgerEntry }) {
  const meta = SOURCE_META[entry.inferenceSource];
  const sent = entry.inferenceSource === 'in_cloud';
  const accent = sent ? 'cloud' : entry.inferenceSource === 'blocked' ? 'danger' : 'device';

  return (
    <li>
      <details className="group">
        <summary className="flex list-none flex-wrap items-center gap-x-2.5 gap-y-1.5 px-4 py-3 text-[13px] transition-colors hover:bg-zinc-50/75 dark:hover:bg-white/[0.025]">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
          <span className="font-medium text-zinc-950 dark:text-white">{entry.feature}</span>
          <span className={`text-xs font-medium ${meta.className}`}>{meta.text}</span>
          <ModeChip mode={entry.mode} />
          {entry.consent && <Badge tone="review">With consent</Badge>}
          {entry.isDemo && <Badge tone="neutral">Demo</Badge>}
          {entry.error && <Badge tone="danger">Failed</Badge>}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {entry.model && <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{entry.model}</span>}
            {entry.bytes > 0 && <span>{formatBytes(entry.bytes)}</span>}
            {entry.durationMs !== undefined && <span>{formatSeconds(entry.durationMs)}</span>}
            <time dateTime={new Date(entry.timestamp).toISOString()}>{formatDateTime(entry.timestamp)}</time>
            <ChevronDown aria-hidden className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-4 dark:border-white/[0.06] dark:bg-white/[0.015]">
          <PayloadViewer
            title={sent ? 'Exact payload sent to the cloud' : 'What happened on this device'}
            content={entry.payloadPreview}
            accent={accent}
            maxHeightClass="max-h-80"
          />

          <dl className="mt-3.5 grid grid-cols-3 gap-2.5 text-xs sm:max-w-lg">
            <Fact label="Raw rows sent" value={String(entry.rawRowCount)} />
            <Fact label="Merchant names" value={String(entry.merchantNameCount)} />
            <Fact label="Model" value={entry.model ?? 'None'} />
          </dl>

          {entry.error && (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              <span className="font-semibold">No answer:</span> {entry.error}
            </p>
          )}
        </div>
      </details>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-[#111114]">
      <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-zinc-950 tabular-nums dark:text-white" title={value}>
        {value}
      </dd>
    </div>
  );
}
