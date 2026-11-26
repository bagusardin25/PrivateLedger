// Privacy Ledger: every AI call the app made, with the exact payload of each
// cloud request. The counters are computed from these entries and are the same
// numbers the Data Boundary panel shows.

import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Download, Inbox, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { SOURCE_META } from '../components/sourceMeta';
import { Badge, Button, Card } from '../components/ui';
import { navigate } from '../lib/actions';
import { db, type LedgerEntry, type LedgerSource } from '../lib/db';
import { downloadText } from '../lib/export';
import { formatBytes, formatDateTime, formatSeconds, plural } from '../lib/format';
import { countLedger } from '../lib/ledger';

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

  if (entries === undefined) return <Card>Loading…</Card>;

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
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Ledger</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
            Every AI call this app made, and the exact payload of each request that left this device. The counters are computed from these entries,
            never assumed.
          </p>
        </div>
        <Button onClick={exportJson} disabled={entries.length === 0}>
          <Download aria-hidden className="size-4" /> Export ledger
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <div className={`col-span-2 rounded-xl px-5 py-4 shadow-sm ring-1 md:col-span-4 xl:col-span-2 ${nothingSent ? 'bg-emerald-50 ring-emerald-200' : 'bg-sky-50 ring-sky-200'}`}>
          <dt className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
            <ShieldCheck aria-hidden className={`size-4 ${nothingSent ? 'text-emerald-700' : 'text-sky-700'}`} /> Raw transactions sent to cloud
          </dt>
          <dd className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{counters.rawSentUser}</dd>
          <dd className="text-xs text-slate-600">
            {counters.rawSentDemo > 0 ? `Your own data · plus ${plural(counters.rawSentDemo, 'demo row')} sent with consent` : 'Your own data'}
          </dd>
        </div>
        <Counter label="Merchant names shared" value={counters.merchantNamesShared} />
        <Counter label="Cloud requests" value={counters.cloudRequests} />
        <Counter label="On-device AI calls" value={counters.onDeviceCalls} />
        <Counter label="Messages blocked" value={counters.blockedMessages} />
      </dl>

      <div role="group" aria-label="Filter ledger entries" className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-200/70 p-1">
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
            <span className="text-xs text-slate-600 tabular-nums">{count(id)}</span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
            <Inbox aria-hidden className="size-6 text-slate-600" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">No AI calls yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-700">Label some transactions, write a summary, or ask the advisor. Each call appears here as it happens.</p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('transactions')}>
            Go to transactions
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-600 ring-1 ring-slate-200">No entries of this kind.</p>
      ) : (
        <ol className="space-y-2" aria-label="Ledger entries, newest first">
          {visible.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      <Card>
        <h2 className="font-semibold">Why each feature runs where it does</h2>
        <p className="text-sm text-slate-600">The inference mode follows how sensitive the data is. Each row is its own Firebase AI Logic model instance.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-600">
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 pr-4 font-medium">Feature</th>
                <th scope="col" className="py-2 pr-4 font-medium">Inference mode</th>
                <th scope="col" className="py-2 pr-4 font-medium">Data it is given</th>
                <th scope="col" className="py-2 font-medium">Where it runs</th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((row) => (
                <tr key={row.feature} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="py-2.5 pr-4 font-medium whitespace-nowrap">{row.feature}</th>
                  <td className="py-2.5 pr-4">
                    <ModeChip mode={row.mode} />
                  </td>
                  <td className="py-2.5 pr-4 text-slate-700">{row.data}</td>
                  <td className="py-2.5 text-slate-700">{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-slate-900/5">
      <dt className="text-xs font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function ModeChip({ mode }: { mode: string }) {
  const onDevice = mode.includes('ON_DEVICE');
  return (
    <code className={`rounded px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ring-1 ring-inset ${onDevice ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-sky-50 text-sky-800 ring-sky-200'}`}>
      {mode}
    </code>
  );
}

function Entry({ entry }: { entry: LedgerEntry }) {
  const meta = SOURCE_META[entry.inferenceSource];
  const sent = entry.inferenceSource === 'in_cloud';
  return (
    <li>
      <details className="group rounded-xl bg-white ring-1 ring-slate-200 open:shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-3 hover:bg-slate-50/70">
          <meta.icon aria-hidden className={`size-4 shrink-0 ${meta.className}`} />
          <span className="font-medium">{entry.feature}</span>
          <Badge tone={meta.tone}>{meta.text}</Badge>
          <ModeChip mode={entry.mode} />
          {entry.consent && <Badge tone="review">With consent</Badge>}
          {entry.isDemo && <Badge tone="neutral">Demo data</Badge>}
          {entry.error && <Badge tone="danger">Failed</Badge>}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 text-xs text-slate-600 tabular-nums">
            {entry.model && <span>{entry.model}</span>}
            {entry.bytes > 0 && <span>{formatBytes(entry.bytes)}</span>}
            {entry.durationMs !== undefined && <span>{formatSeconds(entry.durationMs)}</span>}
            <time dateTime={new Date(entry.timestamp).toISOString()}>{formatDateTime(entry.timestamp)}</time>
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs font-medium text-slate-700">{sent ? 'Exact payload sent to the cloud' : 'What happened on this device'}</p>
          <pre
            className={`mt-1.5 max-h-80 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800 ring-1 ${
              sent ? 'bg-sky-50/60 ring-sky-200' : 'bg-slate-50 ring-slate-200'
            }`}
          >
            {entry.payloadPreview}
          </pre>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <Fact label="Raw rows sent" value={String(entry.rawRowCount)} />
            <Fact label="Merchant names sent" value={String(entry.merchantNameCount)} />
            <Fact label="Model" value={entry.model ?? 'None'} />
          </dl>
          {entry.error && (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-200">
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
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}
