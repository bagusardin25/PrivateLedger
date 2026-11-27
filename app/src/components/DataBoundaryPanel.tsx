// Data Boundary panel: always visible next to the work area. Every number
// here is computed from IndexedDB (transactions and Privacy Ledger entries).
// When an AI call lands, the side it happened on pulses: green for this device,
// blue for the cloud, red for a blocked message.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Ban, ChevronDown, ChevronUp, Cloud, Laptop, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../lib/data/db';
import { formatTime, plural } from '../lib/util/format';
import { countLedger } from '../lib/data/ledger';
import { SOURCE_META } from './sourceMeta';

const FRESH_MS = 4_000;
const BLOCKED_MS = 15_000;

export function DataBoundaryPanel() {
  const entries = useLiveQuery(() => db.ledgerEntries.orderBy('timestamp').toArray(), [], []);
  const stats = useLiveQuery(
    async () => {
      const all = await db.transactions.toArray();
      return {
        rows: all.length,
        demoRows: all.filter((t) => t.isDemo).length,
        byRules: all.filter((t) => t.source === 'rule' || t.source === 'memory' || t.source === 'you').length,
        byModel: all.filter((t) => t.source === 'on-device').length,
        byCloud: all.filter((t) => t.source === 'cloud').length,
      };
    },
    [],
    { rows: 0, demoRows: 0, byRules: 0, byModel: 0, byCloud: 0 },
  );

  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const counters = countLedger(entries);
  const lastCloud = entries.findLast((e) => e.inferenceSource === 'in_cloud');
  const latest = entries.at(-1);

  useEffect(() => {
    if (!latest) return;
    const current = Date.now();
    setNow(current);
    const ttl = latest.inferenceSource === 'blocked' ? BLOCKED_MS : FRESH_MS;
    const remaining = latest.timestamp + ttl - current;
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), remaining + 20);
    return () => window.clearTimeout(timer);
  }, [latest?.id, latest?.timestamp, latest?.inferenceSource]);

  const fresh = latest && now - latest.timestamp < FRESH_MS ? latest : undefined;
  const justBlocked = latest?.inferenceSource === 'blocked' && now - latest.timestamp < BLOCKED_MS;
  const recent = entries.slice(-5).reverse();
  const nothingSent = counters.rawSentUser === 0;

  return (
    <aside
      aria-label="Data boundary"
      className={`flex flex-col overflow-hidden rounded-lg bg-white ring-1 transition-shadow lg:max-h-[calc(100vh-2.5rem)] ${
        justBlocked ? 'ring-2 ring-rose-500' : 'ring-slate-200'
      }`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2.5">
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-emerald-700" />
        <h2 className="text-sm font-semibold">Data boundary</h2>
        <span className="ml-auto text-xs text-slate-600 tabular-nums">{plural(entries.length, 'entry', 'entries')}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="data-boundary-body"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand data boundary panel' : 'Collapse data boundary panel'}
          className="inline-flex size-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          {collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          <span className="sr-only">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
        </button>
      </header>

      {collapsed ? (
        <div id="data-boundary-body" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-emerald-800 tabular-nums">
            <Laptop aria-hidden className="size-3.5" /> {stats.rows.toLocaleString('en-US')} local
          </span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${nothingSent ? 'text-emerald-800' : 'text-sky-800'}`}>
            <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
          </span>
          {justBlocked && (
            <span role="alert" className="w-full font-medium text-rose-700">
              Message blocked on device
            </span>
          )}
        </div>
      ) : (
        <div id="data-boundary-body" className="min-h-0 flex-1 overflow-y-auto">
          <section aria-label="On this device" className="relative bg-emerald-50/70 px-4 py-4">
            {fresh?.inferenceSource === 'on_device' && <span key={fresh.id} aria-hidden className="pulse-device pointer-events-none absolute inset-0" />}
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-800 uppercase">
              <Laptop aria-hidden className="size-4" /> On this device
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-600">Transactions kept here</dt>
                <dd className="text-2xl font-semibold tabular-nums">{stats.rows.toLocaleString('en-US')}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">On-device AI calls</dt>
                <dd className="text-2xl font-semibold tabular-nums">{counters.onDeviceCalls}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-700">
              {plural(stats.byModel, 'row')} labeled by Gemini Nano · {plural(stats.byRules, 'row')} by rules or you
              {stats.byCloud > 0 && <span className="text-sky-800"> · {plural(stats.byCloud, 'row')} by cloud AI with consent</span>}
              {stats.demoRows > 0 && <span className="text-slate-600"> · demo data</span>}
            </p>
          </section>

          <div className="flex items-center gap-2 px-4 py-1.5" role="separator" aria-label="Device boundary">
            <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-slate-700 uppercase">
              <Lock aria-hidden className="size-3" /> Device boundary
            </span>
            <span className="h-px flex-1 border-t-2 border-dashed border-slate-300" />
          </div>

          <section aria-label="Sent to cloud" className="relative bg-sky-50/70 px-4 py-4">
            {fresh?.inferenceSource === 'in_cloud' && <span key={fresh.id} aria-hidden className="pulse-cloud pointer-events-none absolute inset-0" />}
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-sky-800 uppercase">
              <Cloud aria-hidden className="size-4" /> Sent to cloud
            </p>
            <div className="mt-3 flex items-end gap-3">
              <p className="text-5xl leading-none font-semibold tabular-nums" aria-live="polite">
                {counters.rawSentUser}
              </p>
              <p className="pb-1 text-sm leading-tight text-slate-700">
                raw transactions
                <br />
                sent to the cloud
              </p>
            </div>
            <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${nothingSent ? 'text-emerald-800' : 'text-sky-800'}`}>
              <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
              {nothingSent ? 'Counted from every ledger entry, not assumed' : 'Each one was sent with your consent'}
            </p>
            {counters.rawSentDemo > 0 && <p className="mt-1 text-xs text-slate-600">+ {plural(counters.rawSentDemo, 'demo row')} sent with consent</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-600">Merchant names shared</dt>
                <dd className="font-semibold tabular-nums">{counters.merchantNamesShared}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Cloud requests</dt>
                <dd className="font-semibold tabular-nums">{counters.cloudRequests}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs font-medium text-slate-700">Exact payload of the last cloud request</p>
            <pre className="mt-1 max-h-36 overflow-auto rounded bg-white p-2.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800 ring-1 ring-sky-200">
              {lastCloud ? lastCloud.payloadPreview : 'Nothing has left this device yet.'}
            </pre>
          </section>

          {justBlocked && (
            <div role="alert" className="flex items-start gap-2 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
              Blocked on this device. That message contained transaction data and was not sent.
            </div>
          )}

          <section aria-label="Recent activity" className="border-t border-slate-200 px-4 py-3">
            <h3 className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No AI calls yet.</p>
            ) : (
              <ol className="mt-2 space-y-2.5">
                {recent.map((e) => {
                  const source = SOURCE_META[e.inferenceSource];
                  return (
                    <li key={e.id} className="flex gap-2 text-sm">
                      <source.icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${source.className}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium">{e.feature}</span>
                          <span className={`text-xs font-medium ${source.className}`}>{source.text}</span>
                          <time className="ml-auto text-xs text-slate-600 tabular-nums">{formatTime(e.timestamp)}</time>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{e.payloadPreview}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <a href="#/ledger" className="mt-3 inline-flex items-center gap-1 rounded text-sm font-medium text-sky-800 hover:underline">
              Open the full Privacy Ledger <ArrowRight aria-hidden className="size-3.5" />
            </a>
          </section>
        </div>
      )}
    </aside>
  );
}
