// Privacy Ledger: every AI call the app made, with the exact payload of each
// cloud request. The counters are computed from these entries and are the same
// numbers the Data Boundary panel shows.

import { useLiveQuery } from 'dexie-react-hooks';
import { Ban, ChevronDown, Cloud, Cpu, Download, Inbox, ShieldCheck, Tag, type LucideIcon } from 'lucide-react';
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
            <div key={n} className="skeleton h-24 rounded-xl" />
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
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">Privacy Ledger</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            Every AI call this app made, and the exact payload of each request that left this device. All counters are computed directly from these records.
          </p>
        </div>
        <Button variant="secondary" onClick={exportJson} disabled={entries.length === 0}>
          <Download aria-hidden className="size-4" /> Export ledger JSON
        </Button>
      </div>

      {/* FORENSIC AUDIT TELEMETRY STRIP */}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div className="relative col-span-2 overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#0e101c] via-[#14172b] to-[#0b0c14] px-5 py-4 text-white shadow-[0_12px_32px_-10px_rgba(12,13,36,0.5)] md:col-span-4 xl:col-span-2">
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${
              nothingSent ? 'bg-gradient-to-r from-teal-400 via-indigo-400 to-violet-400' : 'bg-gradient-to-r from-indigo-400 to-violet-400'
            }`}
          />
          <dt className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <span
              className={`flex size-6 items-center justify-center rounded-lg ${
                nothingSent ? 'bg-teal-500/20 text-teal-300' : 'bg-indigo-500/20 text-indigo-300'
              }`}
            >
              <ShieldCheck aria-hidden className="size-3.5" />
            </span>
            Raw transactions sent to cloud
          </dt>
          <dd className={`mt-2 text-4xl font-extrabold tracking-tight tabular-nums ${nothingSent ? 'text-teal-300' : 'text-indigo-300'}`}>
            {counters.rawSentUser}
          </dd>
          <dd className="mt-1 text-xs text-zinc-400">
            {counters.rawSentDemo > 0 ? `Your own data · plus ${plural(counters.rawSentDemo, 'demo row')} sent with consent` : 'Your own data · verified from ledger'}
          </dd>
        </div>
        <Counter label="Merchant names shared" value={counters.merchantNamesShared} icon={Tag} tone="bg-stone-100 text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300" />
        <Counter label="Cloud requests" value={counters.cloudRequests} icon={Cloud} tone="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300" />
        <Counter label="On-device AI calls" value={counters.onDeviceCalls} icon={Cpu} tone="bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300" />
        <Counter label="Messages blocked" value={counters.blockedMessages} icon={Ban} tone="bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300" />
      </dl>

      <div
        role="group"
        aria-label="Filter ledger entries"
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
                filter === id ? 'bg-stone-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200' : 'text-zinc-500'
              }`}
            >
              {count(id)}
            </span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-zinc-600 ring-1 ring-stone-200/85 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-white/10">
            <Inbox aria-hidden className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-tight text-zinc-950 dark:text-white">No AI calls yet</h2>
          <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">Label some transactions, write a summary, or ask the advisor. Each call appears here as it happens.</p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('transactions')}>
            Go to transactions
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No entries of this kind.</Card>
      ) : (
        <ol className="space-y-2.5" aria-label="Ledger entries, newest first">
          {visible.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      <Card>
        <h2 className="text-base font-bold tracking-tight text-zinc-950 dark:text-white">Why each feature runs where it does</h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          The inference mode follows how sensitive the data is. Each row is its own Firebase AI Logic model instance.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200/85 dark:border-white/[0.08]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200/80 bg-stone-50/90 text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-400">
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
            <tbody className="divide-y divide-stone-100 bg-white dark:divide-white/[0.06] dark:bg-[#12131c]">
              {MODES.map((row) => (
                <tr key={row.feature} className="hover:bg-stone-50/75 dark:hover:bg-white/[0.03]">
                  <th scope="row" className="px-4 py-3 font-semibold whitespace-nowrap text-zinc-900 dark:text-zinc-100">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3">
                    <ModeChip mode={row.mode} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{row.data}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Counter({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-2xl border border-stone-200/85 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(24,24,27,0.03)] dark:border-white/[0.08] dark:bg-[#12131c]">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</dt>
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon aria-hidden className="size-3.5" />
        </span>
      </div>
      <dd className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950 tabular-nums dark:text-white">{value}</dd>
    </div>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const onDevice = mode.includes('ON_DEVICE');
  return (
    <code
      className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${
        onDevice
          ? 'bg-teal-50/90 text-teal-900 ring-teal-200/85 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60'
          : 'bg-indigo-50/90 text-indigo-900 ring-indigo-200/85 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-700/60'
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
      <details className="group relative overflow-hidden rounded-2xl border border-stone-200/85 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-shadow open:shadow-[0_8px_24px_-8px_rgba(24,24,27,0.1)] dark:border-white/[0.08] dark:bg-[#12131c]">
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${meta.accentBar}`} />
        <summary className="flex list-none flex-wrap items-center gap-x-2.5 gap-y-1.5 py-3.5 pr-4 pl-5 transition-colors hover:bg-stone-50/80 dark:hover:bg-white/[0.03]">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${meta.iconBg}`}>
            <meta.icon aria-hidden className="size-3.5" />
          </span>
          <span className="font-bold text-zinc-900 dark:text-white">{entry.feature}</span>
          <Badge tone={meta.tone}>{meta.text}</Badge>
          <ModeChip mode={entry.mode} />
          {entry.consent && <Badge tone="review">With consent</Badge>}
          {entry.isDemo && <Badge tone="neutral">Demo data</Badge>}
          {entry.error && <Badge tone="danger">Failed</Badge>}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            {entry.model && <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{entry.model}</span>}
            {entry.bytes > 0 && <span>{formatBytes(entry.bytes)}</span>}
            {entry.durationMs !== undefined && <span>{formatSeconds(entry.durationMs)}</span>}
            <time dateTime={new Date(entry.timestamp).toISOString()}>{formatDateTime(entry.timestamp)}</time>
            <ChevronDown aria-hidden className="size-4 text-zinc-400 transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t border-stone-100 bg-stone-50/50 py-4 pr-4 pl-5 dark:border-white/[0.07] dark:bg-[#0b0c14]/60">
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
            <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800">
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
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-stone-200/85 dark:bg-[#12131c] dark:ring-white/[0.08]">
      <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-zinc-900 tabular-nums dark:text-white" title={value}>
        {value}
      </dd>
    </div>
  );
}
