// Data Boundary panel: always visible next to the work area. Every number
// here is computed from IndexedDB (transactions and Privacy Ledger entries).
// When an AI call lands, the side it happened on pulses: jade for this device,
// indigo for the cloud, crimson for a blocked message.

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
  const recent = entries.slice(-5).reverse();
  const nothingSent = counters.rawSentUser === 0;
  const totalAiCalls = counters.onDeviceCalls + counters.cloudRequests;
  const localShare = totalAiCalls > 0 ? Math.round((counters.onDeviceCalls / totalAiCalls) * 100) : 100;

  return (
    <aside
      aria-label="Data boundary"
      className={`flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 lg:max-h-[calc(100vh-5rem)] dark:bg-[#12131c] ${
        justBlocked
          ? 'pulse-blocked ring-2 ring-rose-500 shadow-[0_0_0_4px_rgba(225,29,72,0.16),0_16px_36px_-10px_rgba(225,29,72,0.28)]'
          : 'border border-stone-200/90 shadow-[0_2px_4px_rgba(24,24,27,0.04),0_16px_36px_-12px_rgba(24,24,27,0.12)] dark:border-white/[0.09] dark:shadow-[0_18px_44px_-12px_rgba(0,0,0,0.65)]'
      }`}
    >
      {/* VELVET OBSIDIAN TELEMETRY HEADER */}
      <header className="relative flex shrink-0 items-center gap-2.5 overflow-hidden bg-gradient-to-r from-[#0e101c] via-[#14172b] to-[#111322] px-4 py-3 text-white">
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] ${
            justBlocked
              ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-rose-500'
              : 'bg-gradient-to-r from-teal-400 via-indigo-400 to-violet-400'
          }`}
        />
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
            justBlocked
              ? 'bg-rose-500/20 text-rose-300 ring-rose-400/40'
              : 'bg-teal-400/15 text-teal-300 ring-teal-400/30'
          }`}
        >
          {justBlocked ? <Ban aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
        </span>
        <div className="min-w-0 leading-tight">
          <h2 className="text-[13px] font-bold tracking-tight text-white">Data boundary</h2>
          <p className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
            <span className="relative flex size-1.5">
              <span
                aria-hidden
                className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:hidden ${
                  justBlocked ? 'bg-rose-400' : 'bg-teal-400'
                }`}
              />
              <span aria-hidden className={`relative inline-flex size-1.5 rounded-full ${justBlocked ? 'bg-rose-400' : 'bg-teal-400'}`} />
            </span>
            {justBlocked ? 'Guard intercepted leak' : nothingSent ? 'Live · 0 raw rows leaked' : 'Live · consent logged'}
          </p>
        </div>
        <span className="ml-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] font-semibold text-zinc-200 tabular-nums ring-1 ring-white/10">
          {plural(entries.length, 'log')}
        </span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="data-boundary-body"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand data boundary panel' : 'Collapse data boundary panel'}
          className="inline-flex size-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          <span className="sr-only">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
        </button>
      </header>

      {collapsed ? (
        <div id="data-boundary-body" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-teal-800 tabular-nums dark:text-teal-400">
            <Laptop aria-hidden className="size-3.5" /> {stats.rows.toLocaleString('en-US')} local
          </span>
          <span className="text-stone-300 dark:text-zinc-700" aria-hidden>
            ·
          </span>
          <span
            className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${
              nothingSent ? 'text-teal-800 dark:text-teal-400' : 'text-indigo-700 dark:text-indigo-400'
            }`}
          >
            <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
          </span>
          {justBlocked && (
            <span role="alert" className="w-full rounded-lg bg-rose-50 px-2.5 py-1.5 font-medium text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:ring-rose-800">
              Message blocked on device
            </span>
          )}
        </div>
      ) : (
        <div id="data-boundary-body" className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {/* LOCAL ZONE */}
          <section
            aria-label="On this device"
            className="relative bg-gradient-to-b from-teal-50/75 via-teal-50/25 to-white px-4 pt-3.5 pb-3.5 dark:from-teal-950/35 dark:via-teal-950/10 dark:to-[#12131c]"
          >
            {fresh?.inferenceSource === 'on_device' && <span key={fresh.id} aria-hidden className="pulse-device pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-teal-900 uppercase dark:text-teal-300">
                <span aria-hidden className="size-2 rounded-full bg-teal-600 dark:bg-teal-400" />
                <Laptop aria-hidden className="size-3.5" />
                On this device
              </p>
              {stats.demoRows > 0 && (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-teal-200/80 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-teal-700/50">
                  Demo data
                </span>
              )}
            </div>

            <dl className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/95 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,118,110,0.05)] ring-1 ring-teal-200/75 dark:bg-[#0b0c14]/80 dark:ring-teal-800/45">
                <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Kept locally</dt>
                <dd className="mt-0.5 text-2xl font-extrabold tracking-tight text-zinc-950 tabular-nums dark:text-white">
                  {stats.rows.toLocaleString('en-US')}
                </dd>
              </div>
              <div className="rounded-xl bg-white/95 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,118,110,0.05)] ring-1 ring-teal-200/75 dark:bg-[#0b0c14]/80 dark:ring-teal-800/45">
                <dt className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">On-device calls</dt>
                <dd className="mt-0.5 text-2xl font-extrabold tracking-tight text-teal-800 tabular-nums dark:text-teal-300">
                  {counters.onDeviceCalls}
                </dd>
              </div>
            </dl>

            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">{plural(stats.byModel, 'row')}</span> by Gemini Nano ·{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">{plural(stats.byRules, 'row')}</span> by rules or you
              {stats.byCloud > 0 && <span className="font-semibold text-indigo-700 dark:text-indigo-300"> · {plural(stats.byCloud, 'row')} by cloud AI</span>}
            </p>
          </section>

          {/* PHYSICAL FIREWALL BOUNDARY SEAL */}
          <div className="relative flex items-center gap-2 bg-white px-4 py-1.5 dark:bg-[#12131c]" role="separator" aria-label="Device boundary">
            <span className="h-px flex-1 border-t border-dashed border-stone-300 dark:border-white/15" />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm ${
                justBlocked
                  ? 'bg-rose-600 text-white shadow-rose-500/30'
                  : 'bg-[#141628] text-white ring-1 ring-indigo-500/25 dark:bg-white/[0.08] dark:text-zinc-100 dark:ring-white/15'
              }`}
            >
              <Lock aria-hidden className="size-3 text-teal-400" /> Device boundary
            </span>
            <span className="h-px flex-1 border-t border-dashed border-stone-300 dark:border-white/15" />
          </div>

          {justBlocked && (
            <div
              role="alert"
              className="mx-4 mt-2 flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-900 ring-1 ring-rose-300/90 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-800"
            >
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                <strong className="font-bold">Blocked on this device.</strong> That message contained transaction data and was never sent.
              </span>
            </div>
          )}

          {/* CLOUD ZONE */}
          <section
            aria-label="Sent to cloud"
            className="relative bg-gradient-to-b from-indigo-50/70 via-indigo-50/20 to-white px-4 pt-3.5 pb-4 dark:from-indigo-950/35 dark:via-indigo-950/10 dark:to-[#12131c]"
          >
            {fresh?.inferenceSource === 'in_cloud' && <span key={fresh.id} aria-hidden className="pulse-cloud pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-indigo-900 uppercase dark:text-indigo-300">
                <span aria-hidden className="size-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                <Cloud aria-hidden className="size-3.5" />
                Sent to cloud
              </p>
              {totalAiCalls > 0 && (
                <span className="text-[10px] font-semibold text-zinc-500 tabular-nums dark:text-zinc-400">{localShare}% local AI</span>
              )}
            </div>

            <div className="mt-2.5 rounded-xl bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(30,32,88,0.05)] ring-1 ring-indigo-200/75 dark:bg-[#0b0c14]/80 dark:ring-indigo-800/45">
              <div className="flex items-end gap-3">
                <p
                  className={`text-4xl leading-none font-extrabold tracking-tight tabular-nums ${
                    nothingSent ? 'text-teal-700 dark:text-teal-400' : 'text-indigo-700 dark:text-indigo-300'
                  }`}
                  aria-live="polite"
                >
                  {counters.rawSentUser}
                </p>
                <p className="pb-0.5 text-xs leading-snug font-medium text-zinc-600 dark:text-zinc-300">
                  raw transactions
                  <br />
                  sent to the cloud
                </p>
              </div>
              <p
                className={`mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold ${
                  nothingSent ? 'text-teal-800 dark:text-teal-400' : 'text-indigo-700 dark:text-indigo-300'
                }`}
              >
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                {nothingSent ? 'Verified from every ledger entry' : 'Each one was sent with your consent'}
              </p>
              {counters.rawSentDemo > 0 && (
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">+ {plural(counters.rawSentDemo, 'demo row')} sent with consent</p>
              )}
            </div>

            <dl className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-indigo-200/65 dark:bg-[#0b0c14]/60 dark:ring-indigo-800/40">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Merchant names</dt>
                <dd className="text-base font-bold text-zinc-950 tabular-nums dark:text-white">{counters.merchantNamesShared}</dd>
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-indigo-200/65 dark:bg-[#0b0c14]/60 dark:ring-indigo-800/40">
                <dt className="text-[11px] text-zinc-500 dark:text-zinc-400">Cloud requests</dt>
                <dd className="text-base font-bold text-zinc-950 tabular-nums dark:text-white">{counters.cloudRequests}</dd>
              </div>
            </dl>

            <PayloadViewer
              title="Last cloud payload"
              content={lastCloud?.payloadPreview}
              emptyText="Nothing has left this device yet."
              accent="cloud"
              maxHeightClass="max-h-36"
              className="mt-3"
            />
          </section>

          {/* RECENT ACTIVITY */}
          <section aria-label="Recent activity" className="border-t border-stone-200/80 bg-white px-4 py-3.5 dark:border-white/[0.08] dark:bg-[#12131c]">
            <h3 className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 rounded-xl bg-stone-50 px-3 py-3 text-center text-xs text-zinc-500 ring-1 ring-stone-200/70 dark:bg-white/[0.03] dark:text-zinc-400 dark:ring-white/[0.08]">
                No AI calls yet. Every call appears here live.
              </p>
            ) : (
              <ol className="relative mt-2.5 space-y-2.5">
                {recent.map((e) => {
                  const source = SOURCE_META[e.inferenceSource];
                  return (
                    <li key={e.id} className="flex gap-2.5 text-xs">
                      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${source.iconBg}`}>
                        <source.icon aria-hidden className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{e.feature}</span>
                          <time className="ml-auto shrink-0 text-[11px] text-zinc-400 tabular-nums dark:text-zinc-500">{formatTime(e.timestamp)}</time>
                        </div>
                        <span className={`block text-[11px] font-semibold ${source.className}`}>{source.text}</span>
                        <p className="mt-0.5 line-clamp-2 font-mono text-[10.5px] text-zinc-500 dark:text-zinc-400">{e.payloadPreview}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <a
              href="#/ledger"
              className="mt-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-stone-100/90 px-3 py-2 text-xs font-semibold text-ink-800 ring-1 ring-stone-200/85 transition-colors hover:bg-ink-50 hover:ring-ink-200 dark:bg-white/[0.06] dark:text-indigo-300 dark:ring-white/10 dark:hover:bg-white/[0.1]"
            >
              Open the full Privacy Ledger <ArrowRight aria-hidden className="size-3.5" />
            </a>
          </section>
        </div>
      )}
    </aside>
  );
}
