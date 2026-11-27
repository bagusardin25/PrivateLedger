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
      aria-label="Data boundary"
      className={`flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 lg:max-h-[calc(100vh-5.5rem)] dark:bg-[#111114] ${
        justBlocked
          ? 'pulse-blocked border-rose-500 ring-1 ring-rose-500/40'
          : 'border-zinc-200/80 dark:border-white/[0.08]'
      }`}
    >
      {/* CLEAN ARCHITECTURAL HEADER */}
      <header className="flex shrink-0 items-center gap-2.5 border-b border-zinc-100 px-4 py-3 dark:border-white/[0.06]">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
            justBlocked
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
          }`}
        >
          {justBlocked ? <Ban aria-hidden className="size-3.5" /> : <ShieldCheck aria-hidden className="size-3.5" />}
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-[13px] font-semibold tracking-tight text-zinc-950 dark:text-white">Data boundary</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span aria-hidden className={`size-1.5 rounded-full ${justBlocked ? 'bg-rose-500' : 'bg-emerald-600 dark:bg-emerald-400'}`} />
            {justBlocked ? 'Guard intercepted leak' : nothingSent ? 'Live · 0 raw rows leaked' : 'Live · consent logged'}
          </p>
        </div>
        <span className="ml-auto text-[11px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">{plural(entries.length, 'log')}</span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="data-boundary-body"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand data boundary panel' : 'Collapse data boundary panel'}
          className="inline-flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
        >
          {collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          <span className="sr-only">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
        </button>
      </header>

      {collapsed ? (
        <div id="data-boundary-body" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-zinc-700 tabular-nums dark:text-zinc-300">
            <Laptop aria-hidden className="size-3.5 text-emerald-700 dark:text-emerald-400" /> {stats.rows.toLocaleString('en-US')} local
          </span>
          <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-medium tabular-nums ${
              nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
            }`}
          >
            <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
          </span>
          {justBlocked && (
            <span
              role="alert"
              className="w-full rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-medium text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              Message blocked on device
            </span>
          )}
        </div>
      ) : (
        <div id="data-boundary-body" className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {/* LOCAL ZONE */}
          <section aria-label="On this device" className="relative px-4 py-4">
            {fresh?.inferenceSource === 'on_device' && <span key={fresh.id} aria-hidden className="pulse-device pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                On this device
              </p>
              {stats.demoRows > 0 && (
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Demo data</span>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 divide-x divide-zinc-100 dark:divide-white/[0.06]">
              <div className="pr-3">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Kept locally</dt>
                <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">
                  {stats.rows.toLocaleString('en-US')}
                </dd>
              </div>
              <div className="pl-3.5">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">On-device calls</dt>
                <dd className="mt-0.5 text-2xl font-semibold tracking-tight text-emerald-700 tabular-nums dark:text-emerald-400">
                  {counters.onDeviceCalls}
                </dd>
              </div>
            </dl>

            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{plural(stats.byModel, 'row')}</span> by Gemini Nano ·{' '}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{plural(stats.byRules, 'row')}</span> by rules or you
              {stats.byCloud > 0 && <span className="font-medium text-indigo-700 dark:text-indigo-400"> · {plural(stats.byCloud, 'row')} by cloud AI</span>}
            </p>
          </section>

          {/* ARCHITECTURAL BOUNDARY SEAM */}
          <div className="relative flex items-center gap-2 px-4 py-0.5" role="separator" aria-label="Device boundary">
            <span className="h-px flex-1 border-t border-dashed border-zinc-200 dark:border-white/[0.1]" />
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                justBlocked
                  ? 'border-rose-500 bg-rose-600 text-white'
                  : 'border-zinc-200/90 bg-zinc-50 text-zinc-600 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-zinc-300'
              }`}
            >
              <Lock aria-hidden className={`size-2.5 ${justBlocked ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'}`} />
              Boundary
            </span>
            <span className="h-px flex-1 border-t border-dashed border-zinc-200 dark:border-white/[0.1]" />
          </div>

          {justBlocked && (
            <div
              role="alert"
              className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-900 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
            >
              <Ban aria-hidden className="mt-0.5 size-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                <strong className="font-semibold">Blocked on this device.</strong> That message contained transaction data and was never sent.
              </span>
            </div>
          )}

          {/* CLOUD ZONE */}
          <section aria-label="Sent to cloud" className="relative px-4 py-4">
            {fresh?.inferenceSource === 'in_cloud' && <span key={fresh.id} aria-hidden className="pulse-cloud pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-indigo-700 uppercase dark:text-indigo-400">
                <span aria-hidden className="size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                Sent to cloud
              </p>
              {totalAiCalls > 0 && (
                <span className="text-[11px] font-medium text-zinc-500 tabular-nums dark:text-zinc-400">{localShare}% local AI</span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-2.5">
              <p
                className={`text-3xl leading-none font-semibold tracking-tight tabular-nums ${
                  nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-700 dark:text-indigo-400'
                }`}
                aria-live="polite"
              >
                {counters.rawSentUser}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">raw transactions sent</p>
            </div>

            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <ShieldCheck aria-hidden className={`size-3.5 shrink-0 ${nothingSent ? 'text-emerald-700 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              {nothingSent ? 'Verified from every ledger entry' : 'Each one was sent with your consent'}
            </p>
            {counters.rawSentDemo > 0 && (
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">+ {plural(counters.rawSentDemo, 'demo row')} sent with consent</p>
            )}

            <dl className="mt-3.5 grid grid-cols-2 divide-x divide-zinc-100 border-y border-zinc-100 py-2.5 dark:divide-white/[0.06] dark:border-white/[0.06]">
              <div className="pr-3">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Merchant names</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-950 tabular-nums dark:text-white">{counters.merchantNamesShared}</dd>
              </div>
              <div className="pl-3.5">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Cloud requests</dt>
                <dd className="mt-0.5 text-sm font-semibold text-zinc-950 tabular-nums dark:text-white">{counters.cloudRequests}</dd>
              </div>
            </dl>

            <PayloadViewer
              title="Last cloud payload"
              content={lastCloud?.payloadPreview}
              emptyText="Nothing has left this device yet."
              accent="cloud"
              maxHeightClass="max-h-32"
              className="mt-3.5"
            />
          </section>

          {/* RECENT ACTIVITY */}
          <section aria-label="Recent activity" className="border-t border-zinc-100 px-4 py-3.5 dark:border-white/[0.06]">
            <h3 className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 py-2 text-xs text-zinc-500 dark:text-zinc-400">No AI calls yet. Every call appears here live.</p>
            ) : (
              <ol className="mt-2.5 divide-y divide-zinc-100 dark:divide-white/[0.05]">
                {recent.map((e) => {
                  const source = SOURCE_META[e.inferenceSource];
                  return (
                    <li key={e.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0 text-xs">
                      <span aria-hidden className={`mt-1.5 size-1.5 shrink-0 rounded-full ${source.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{e.feature}</span>
                          <time className="ml-auto shrink-0 text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">{formatTime(e.timestamp)}</time>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">{e.payloadPreview}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <a
              href="#/ledger"
              className="mt-3 flex items-center justify-between rounded-lg border border-zinc-200/80 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 dark:border-white/[0.08] dark:text-zinc-300 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.04] dark:hover:text-white"
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
