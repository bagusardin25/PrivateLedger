// Data Boundary panel: always visible next to the work area. Every number
// here is computed from IndexedDB (transactions and Privacy Ledger entries).
// When an AI call lands, the side it happened on pulses cleanly: emerald for
// this device, indigo for the cloud, rose for a blocked message.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Ban, ChevronDown, ChevronUp, Cloud, Laptop, Lock, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../lib/data/db';
import { formatTime, plural } from '../lib/util/format';
import { countLedger } from '../lib/data/ledger';
import { PayloadViewer } from './PayloadViewer';
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

  const latestTimestamp = latest?.timestamp;
  const latestBlocked = latest?.inferenceSource === 'blocked';
  useEffect(() => {
    if (latestTimestamp === undefined) return;
    const remaining = latestTimestamp + (latestBlocked ? BLOCKED_MS : FRESH_MS) - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), remaining + 20);
    return () => window.clearTimeout(timer);
  }, [latestTimestamp, latestBlocked]);

  const fresh = latest && now - latest.timestamp < FRESH_MS ? latest : undefined;
  const justBlocked = latest?.inferenceSource === 'blocked' && now - latest.timestamp < BLOCKED_MS;
  const recent = entries.slice(-4).reverse();
  const nothingSent = counters.rawSentUser === 0;
  const totalAiCalls = counters.onDeviceCalls + counters.cloudRequests;
  const localShare = totalAiCalls > 0 ? Math.round((counters.onDeviceCalls / totalAiCalls) * 100) : 100;

  return (
    <aside
      aria-label="Privacy"
      className={`flex flex-col overflow-hidden rounded-xl border bg-surface transition-all duration-200 lg:max-h-[calc(100vh-5.5rem)] ${
        justBlocked
          ? 'pulse-blocked border-rose-500 ring-1 ring-rose-500/40'
          : 'border-line'
      }`}
    >
      {/* CLEAN ARCHITECTURAL HEADER */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
            justBlocked
              ? 'bg-danger-soft text-danger-fg'
              : 'bg-device-soft text-device-fg'
          }`}
        >
          {justBlocked ? <Ban aria-hidden className="size-3.5" /> : <ShieldCheck aria-hidden className="size-3.5" />}
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-[13px] font-semibold tracking-tight text-fg">Privacy</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
            <span aria-hidden className={`size-1.5 rounded-full ${justBlocked ? 'bg-rose-500' : 'bg-device'}`} />
            {justBlocked ? 'Message stopped on your laptop' : nothingSent ? 'Live · no transactions sent' : 'Live · sent only with your OK'}
          </p>
        </div>
        <span className="ml-auto text-[11px] font-medium text-fg-muted tabular-nums">{plural(entries.length, 'record')}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="data-boundary-body"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand privacy panel' : 'Collapse privacy panel'}
          className="inline-flex size-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
        >
          {collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          <span className="sr-only">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
        </button>
      </header>

      {collapsed ? (
        <div id="data-boundary-body" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-fg-secondary tabular-nums">
            <Laptop aria-hidden className="size-3.5 text-device-fg" /> {stats.rows.toLocaleString('en-US')} on laptop
          </span>
          <span className="text-line-strong" aria-hidden>
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
              nothingSent ? 'text-device-fg' : 'text-cloud-fg'
            }`}
          >
            <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} sent
          </span>
          {justBlocked && (
            <span
              role="alert"
              className="w-full rounded-lg border border-danger-line bg-danger-soft px-2.5 py-1.5 font-medium text-danger-fg"
            >
              Message stopped on your laptop
            </span>
          )}
        </div>
      ) : (
        <div id="data-boundary-body" className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {/* LOCAL ZONE */}
          <section aria-label="On your laptop" className="relative px-4 py-4">
            {fresh?.inferenceSource === 'on_device' && <span key={fresh.id} aria-hidden className="pulse-device pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-device-fg uppercase">
                <span aria-hidden className="size-1.5 rounded-full bg-device" />
                On your laptop
              </p>
              {stats.demoRows > 0 && (
                <span className="text-[11px] font-medium text-fg-muted">Demo data</span>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 divide-x divide-line-soft">
              <div className="pr-3">
                <dt className="text-[11px] text-fg-muted">Transactions kept</dt>
                <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-fg tabular-nums">
                  {stats.rows.toLocaleString('en-US')}
                </dd>
              </div>
              <div className="pl-3.5">
                <dt className="text-[11px] text-fg-muted">Laptop AI tasks</dt>
                <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-device-fg tabular-nums">
                  {counters.onDeviceCalls}
                </dd>
              </div>
            </dl>

            <p className="mt-2.5 text-[11px] leading-relaxed text-fg-muted">
              Sorted: <span className="font-medium text-fg-secondary">{stats.byModel}</span> by Laptop AI ·{' '}
              <span className="font-medium text-fg-secondary">{stats.byRules}</span> by your rules or you
              {stats.byCloud > 0 && <span className="font-medium text-cloud-fg"> · {stats.byCloud} by Cloud AI</span>}
            </p>
          </section>

          {/* ARCHITECTURAL BOUNDARY SEAM */}
          <div className="relative flex items-center gap-2 px-4 py-0.5" role="separator" aria-label="Line between your laptop and the cloud">
            <span className="h-px flex-1 border-t border-dashed border-line" />
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                justBlocked
                  ? 'border-rose-500 bg-rose-600 text-white'
                  : 'border-line bg-sunken text-fg-secondary'
              }`}
            >
              <Lock aria-hidden className={`size-2.5 ${justBlocked ? 'text-white' : 'text-device-fg'}`} />
              Privacy line
            </span>
            <span className="h-px flex-1 border-t border-dashed border-line" />
          </div>

          {justBlocked && (
            <div
              role="alert"
              className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger-ink"
            >
              <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0 text-danger-fg" />
              <span>
                <strong className="font-semibold">Stopped on your laptop.</strong> That message included transaction details, so it was never sent.
              </span>
            </div>
          )}

          {/* CLOUD ZONE */}
          <section aria-label="Sent to the cloud" className="relative px-4 py-4">
            {fresh?.inferenceSource === 'in_cloud' && <span key={fresh.id} aria-hidden className="pulse-cloud pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-cloud-fg uppercase">
                <span aria-hidden className="size-1.5 rounded-full bg-cloud" />
                Sent to the cloud
              </p>
              {totalAiCalls > 0 && (
                <span className="text-[11px] font-medium text-fg-muted tabular-nums">{localShare}% AI on laptop</span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <p
                className={`text-3xl leading-none font-semibold tracking-tight tabular-nums ${
                  nothingSent ? 'text-device-fg' : 'text-cloud-fg'
                }`}
                aria-live="polite"
              >
                {counters.rawSentUser}
              </p>
              <p className="text-xs text-fg-secondary">transactions sent</p>
            </div>

            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
              <ShieldCheck aria-hidden className={`size-3.5 shrink-0 ${nothingSent ? 'text-device-fg' : 'text-cloud-fg'}`} />
              {nothingSent ? 'Checked against every Privacy Ledger record' : 'Each one was sent with your OK'}
            </p>
            {counters.rawSentDemo > 0 && (
              <p className="mt-1 text-[11px] text-fg-muted">+ {plural(counters.rawSentDemo, 'demo transaction')} sent with your OK</p>
            )}

            <dl className="mt-3.5 grid grid-cols-2 divide-x divide-line-soft border-y border-line-soft py-2.5">
              <div className="pr-3">
                <dt className="text-[11px] text-fg-muted">Merchant names</dt>
                <dd className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{counters.merchantNamesShared}</dd>
              </div>
              <div className="pl-3.5">
                <dt className="text-[11px] text-fg-muted">Cloud AI requests</dt>
                <dd className="mt-0.5 text-sm font-semibold text-fg tabular-nums">{counters.cloudRequests}</dd>
              </div>
            </dl>

            <PayloadViewer
              title="Last message to the cloud"
              content={lastCloud?.payloadPreview}
              emptyText="Nothing has left your laptop yet."
              accent="cloud"
              maxHeightClass="max-h-32"
              className="mt-3.5"
            />
          </section>

          {/* RECENT ACTIVITY */}
          <section aria-label="Recent activity" className="border-t border-line-soft px-4 py-3.5">
            <h3 className="text-[11px] font-semibold tracking-wide text-fg-muted uppercase">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 py-2 text-xs text-fg-muted">No AI activity yet. Each step shows up here as it happens.</p>
            ) : (
              <ol className="mt-2.5 divide-y divide-line-soft">
                {recent.map((e) => {
                  const source = SOURCE_META[e.inferenceSource];
                  return (
                    <li key={e.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0 text-xs">
                      <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${source.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate font-medium text-fg">{e.feature}</span>
                          <time className="ml-auto shrink-0 text-[11px] text-fg-muted tabular-nums">{formatTime(e.timestamp)}</time>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] text-fg-muted">{e.payloadPreview}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <a
              href="#/ledger"
              className="mt-3 flex items-center justify-between rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg-secondary transition-colors hover:border-line-strong hover:bg-sunken hover:text-fg"
            >
              <span>Open Privacy Ledger</span>
              <ArrowRight aria-hidden className="size-3.5 text-zinc-400" />
            </a>
          </section>
        </div>
      )}
    </aside>
  );
}
