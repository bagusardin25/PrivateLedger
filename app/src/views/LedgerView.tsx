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
import { countLedger, FEATURE } from '../lib/data/ledger';

type Filter = 'all' | LedgerSource;

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['in_cloud', 'Sent to the cloud'],
  ['on_device', 'On your laptop'],
  ['blocked', 'Stopped'],
  ['refused', 'Not sent'],
];

/** Why each feature runs where it does: the mode follows the sensitivity of the data. */
const MODES = [
  { feature: FEATURE.labeling, mode: 'ONLY_ON_DEVICE', data: 'Your bank transactions and business profile', where: 'Never leaves your laptop' },
  { feature: FEATURE.guard, mode: 'ONLY_ON_DEVICE', data: 'Your chat message, before it is sent', where: 'Checked on your laptop first' },
  { feature: FEATURE.explain, mode: 'PREFER_ON_DEVICE', data: 'One merchant name', where: 'Your laptop; the cloud only if you agree' },
  { feature: FEATURE.summary, mode: 'PREFER_IN_CLOUD', data: 'Totals per category for one month', where: "The cloud; your laptop if the cloud can't answer" },
  { feature: FEATURE.advisor, mode: 'ONLY_IN_CLOUD', data: 'Your question, plus totals from your laptop', where: 'The cloud, which never sees a transaction' },
  { feature: FEATURE.cloudLabeling, mode: 'ONLY_IN_CLOUD', data: 'One bank description per merchant', where: 'The cloud, only after you agree' },
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
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Privacy Ledger</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted sm:text-sm">
            A record of every AI task this app ran, with the exact text of anything sent to the cloud. Every number here is counted from these records.
          </p>
        </div>
        <Button variant="secondary" className="min-h-8.5 px-3 text-xs" onClick={exportJson} disabled={entries.length === 0}>
          <Download aria-hidden className="size-3.5" /> Export records (JSON)
        </Button>
      </div>

      {/* UNIFIED FORENSIC TELEMETRY STRIP */}
      <dl className="grid grid-cols-2 divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-4 xl:grid-cols-6 xl:divide-x xl:divide-y-0">
        <div className="col-span-2 px-5 py-4 md:col-span-4 xl:col-span-2">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <ShieldCheck aria-hidden className={`size-3.5 ${nothingSent ? 'text-device-fg' : 'text-cloud-fg'}`} />
            Transactions sent to the cloud
          </dt>
          <dd
            className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${
              nothingSent ? 'text-device-fg' : 'text-cloud-fg'
            }`}
          >
            {counters.rawSentUser}
          </dd>
          <dd className="mt-0.5 text-[11px] text-fg-muted">
            {counters.rawSentDemo > 0 ? `Your own data · +${plural(counters.rawSentDemo, 'demo transaction')} with your OK` : 'Your own data · checked against every record'}
          </dd>
        </div>
        <Counter label="Merchant names shared" value={counters.merchantNamesShared} className="border-r border-line-soft md:border-r xl:border-r-0" />
        <Counter label="Cloud AI requests" value={counters.cloudRequests} className="md:border-r md:border-line-soft xl:border-r-0" />
        <Counter label="Laptop AI tasks" value={counters.onDeviceCalls} tone="text-device-fg" className="border-r border-line-soft md:border-r xl:border-r-0" />
        <Counter label="Messages stopped" value={counters.blockedMessages} tone={counters.blockedMessages > 0 ? 'text-danger-fg' : undefined} />
      </dl>

      <div
        role="group"
        aria-label="Filter records"
        className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
      >
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 ${
              filter === id
                ? 'bg-inverse text-on-inverse'
                : 'text-fg-secondary hover:bg-subtle hover:text-fg'
            }`}
          >
            {label}
            <span className={`text-[11px] tabular-nums ${filter === id ? 'opacity-75' : 'text-fg-muted'}`}>{count(id)}</span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card className="flex flex-col items-center py-14 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl border border-line bg-sunken text-fg-muted">
            <Inbox aria-hidden className="size-5" />
          </span>
          <h2 className="mt-4 text-base font-semibold tracking-tight text-fg">No AI activity yet</h2>
          <p className="mt-1.5 max-w-sm text-sm text-fg-muted">
            Sort some transactions, write a summary, or ask the Advisor. Each step shows up here as it happens.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('transactions')}>
            Go to transactions
          </Button>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="py-10 text-center text-xs text-fg-muted">No records of this kind.</Card>
      ) : (
        <ol className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-surface" aria-label="Records, newest first">
          {visible.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
        </ol>
      )}

      <Card>
        <h2 className="text-sm font-semibold tracking-tight text-fg">Why each feature runs where it does</h2>
        <p className="mt-0.5 text-xs text-fg-muted">
          The more private the data, the closer it stays to you. Technical note: each row is its own Firebase AI Logic model, and the code shows its inference mode.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="border-b border-line bg-sunken text-[11px] font-medium text-fg-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Feature
                </th>
                <th scope="col" className="px-4 py-2.5">
                  AI mode
                </th>
                <th scope="col" className="px-4 py-2.5">
                  What it sees
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Where it runs
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-surface">
              {MODES.map((row) => (
                <tr key={row.feature} className="hover:bg-sunken">
                  <th scope="row" className="px-4 py-3 font-medium whitespace-nowrap text-fg">
                    {row.feature}
                  </th>
                  <td className="px-4 py-3">
                    <ModeChip mode={row.mode} />
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">{row.data}</td>
                  <td className="px-4 py-3 text-fg-secondary">{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Counter({ label, value, tone = 'text-fg', className = '' }: { label: string; value: number; tone?: string; className?: string }) {
  return (
    <div className={`px-4 py-4 ${className}`}>
      <dt className="text-xs font-medium text-fg-muted">{label}</dt>
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
          ? 'border-device-line bg-device-soft text-device-fg'
          : 'border-cloud-line bg-cloud-soft text-cloud-fg'
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
        <summary className="flex list-none flex-wrap items-center gap-x-2.5 gap-y-1.5 px-4 py-3 text-[13px] transition-colors hover:bg-sunken">
          <span aria-hidden className={`size-2 shrink-0 rounded-full ${meta.dot}`} />
          <span className="font-medium text-fg">{entry.feature}</span>
          <span className={`text-xs font-medium ${meta.className}`}>{meta.text}</span>
          <ModeChip mode={entry.mode} />
          {entry.consent && <Badge tone="review">With your OK</Badge>}
          {entry.isDemo && <Badge tone="neutral">Demo</Badge>}
          {entry.error && <Badge tone="danger">Failed</Badge>}
          <span className="ml-auto flex flex-wrap items-center gap-x-3 text-xs text-fg-muted tabular-nums">
            {entry.model && <span className="font-mono text-[11px] text-fg-muted">{entry.model}</span>}
            {entry.bytes > 0 && <span>{formatBytes(entry.bytes)}</span>}
            {entry.durationMs !== undefined && <span>{formatSeconds(entry.durationMs)}</span>}
            <time dateTime={new Date(entry.timestamp).toISOString()}>{formatDateTime(entry.timestamp)}</time>
            <ChevronDown aria-hidden className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="border-t border-line-soft bg-sunken px-4 py-4">
          <PayloadViewer
            title={sent ? 'Exact text sent to the cloud' : 'What happened on your laptop'}
            content={entry.payloadPreview}
            accent={accent}
            maxHeightClass="max-h-80"
          />

          <dl className="mt-3.5 grid grid-cols-3 gap-2.5 text-xs sm:max-w-lg">
            <Fact label="Transactions sent" value={String(entry.rawRowCount)} />
            <Fact label="Merchant names" value={String(entry.merchantNameCount)} />
            <Fact label="AI model" value={entry.model ?? 'None'} />
          </dl>

          {entry.error && (
            <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger-ink">
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
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-fg tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  );
}
