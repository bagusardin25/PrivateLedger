// Data Boundary panel: always visible next to the work area. Every number
// here is computed from IndexedDB (transactions and Privacy Ledger entries).
// When an AI call lands, the side it happened on pulses: green for this device,
// blue for the cloud, red for a blocked message.

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Ban, ChevronDown, ChevronUp, Cloud, Laptop, Lock, ShieldCheck, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '../lib/data/db';
import { formatTime, plural } from '../lib/util/format';
import { countLedger } from '../lib/data/ledger';
import { SOURCE_META } from './sourceMeta';
import { CopyButton } from './ui';

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

  // `now` only moves forward when a highlight should end. An entry newer than
  // `now` counts as fresh, so a new call lights up without a synchronous update.
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

  return (
    <aside
      aria-label="Data boundary"
      className={`flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 lg:max-h-[calc(100vh-5rem)] ${
        justBlocked
          ? 'pulse-blocked ring-2 ring-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.12),0_12px_28px_-8px_rgba(244,63,94,0.22)]'
          : 'border border-slate-200/85 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-10px_rgba(15,23,42,0.1)]'
      }`}
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-200/80 bg-slate-50/70 px-4 py-3">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
            justBlocked
              ? 'bg-rose-100 text-rose-700 ring-rose-300'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200/90'
          }`}
        >
          {justBlocked ? <Ban aria-hidden className="size-4" /> : <ShieldCheck aria-hidden className="size-4" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">Data boundary</h2>
        </div>
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 tabular-nums ring-1 ring-slate-200/90">
          {plural(entries.length, 'entry', 'entries')}
        </span>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="data-boundary-body"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expand data boundary panel' : 'Collapse data boundary panel'}
          className="inline-flex size-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
        >
          {collapsed ? <ChevronDown aria-hidden className="size-4" /> : <ChevronUp aria-hidden className="size-4" />}
          <span className="sr-only">{collapsed ? 'Expand panel' : 'Collapse panel'}</span>
        </button>
      </header>

      {collapsed ? (
        <div id="data-boundary-body" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 tabular-nums">
            <Laptop aria-hidden className="size-3.5" /> {stats.rows.toLocaleString('en-US')} local
          </span>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <span className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${nothingSent ? 'text-emerald-800' : 'text-sky-800'}`}>
            <Cloud aria-hidden className="size-3.5" /> {counters.rawSentUser} raw sent
          </span>
          {justBlocked && (
            <span role="alert" className="w-full rounded-lg bg-rose-50 px-2.5 py-1.5 font-medium text-rose-700 ring-1 ring-rose-200">
              Message blocked on device
            </span>
          )}
        </div>
      ) : (
        <div id="data-boundary-body" className="thin-scroll min-h-0 flex-1 overflow-y-auto">
          {/* LOCAL ZONE */}
          <section aria-label="On this device" className="relative bg-gradient-to-b from-emerald-50/85 via-emerald-50/35 to-white px-4 pt-4 pb-3.5">
            {fresh?.inferenceSource === 'on_device' && <span key={fresh.id} aria-hidden className="pulse-device pointer-events-none absolute inset-0" />}
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-emerald-800 uppercase">
                <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
                <Laptop aria-hidden className="size-3.5" />
                On this device
              </p>
              {stats.demoRows > 0 && (
                <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-emerald-200/70">
                  Demo data
                </span>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(6,78,59,0.04)] ring-1 ring-emerald-200/70">
                <dt className="text-[11px] font-medium text-slate-500">Kept locally</dt>
                <dd className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{stats.rows.toLocaleString('en-US')}</dd>
              </div>
              <div className="rounded-xl bg-white/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(6,78,59,0.04)] ring-1 ring-emerald-200/70">
                <dt className="text-[11px] font-medium text-slate-500">On-device calls</dt>
                <dd className="mt-0.5 text-2xl font-bold tracking-tight text-emerald-800 tabular-nums">{counters.onDeviceCalls}</dd>
              </div>
            </dl>

            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
              <span className="font-medium text-slate-800">{plural(stats.byModel, 'row')}</span> by Gemini Nano ·{' '}
              <span className="font-medium text-slate-800">{plural(stats.byRules, 'row')}</span> by rules or you
              {stats.byCloud > 0 && <span className="font-medium text-sky-800"> · {plural(stats.byCloud, 'row')} by cloud AI</span>}
            </p>
          </section>

          {/* PHYSICAL BOUNDARY SEAL */}
          <div className="relative flex items-center gap-2 bg-white px-4 py-1.5" role="separator" aria-label="Device boundary">
            <span className="h-px flex-1 border-t border-dashed border-slate-300" />
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase shadow-xs ${
                justBlocked
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-white'
              }`}
            >
              <Lock aria-hidden className="size-3" /> Device boundary
            </span>
            <span className="h-px flex-1 border-t border-dashed border-slate-300" />
          </div>

          {justBlocked && (
            <div role="alert" className="mx-4 mt-2 flex items-start gap-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed text-rose-900 ring-1 ring-rose-300/80">
              <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <span>
                <strong className="font-semibold">Blocked on this device.</strong> That message contained transaction data and was never sent.
              </span>
            </div>
          )}

          {/* CLOUD ZONE */}
          <section aria-label="Sent to cloud" className="relative bg-gradient-to-b from-sky-50/75 via-sky-50/30 to-white px-4 pt-3.5 pb-4">
            {fresh?.inferenceSource === 'in_cloud' && <span key={fresh.id} aria-hidden className="pulse-cloud pointer-events-none absolute inset-0" />}
            <p className="flex items-center gap-2 text-[11px] font-bold tracking-wider text-sky-800 uppercase">
              <span aria-hidden className="size-2 rounded-full bg-sky-500" />
              <Cloud aria-hidden className="size-3.5" />
              Sent to cloud
            </p>

            <div className="mt-3 rounded-xl bg-white/95 p-3.5 shadow-[0_1px_2px_rgba(12,74,110,0.05)] ring-1 ring-sky-200/75">
              <div className="flex items-end gap-3">
                <p
                  className={`text-4xl leading-none font-bold tracking-tight tabular-nums ${
                    nothingSent ? 'text-emerald-700' : 'text-sky-800'
                  }`}
                  aria-live="polite"
                >
                  {counters.rawSentUser}
                </p>
                <p className="pb-0.5 text-xs leading-snug font-medium text-slate-600">
                  raw transactions
                  <br />
                  sent to the cloud
                </p>
              </div>
              <p className={`mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold ${nothingSent ? 'text-emerald-800' : 'text-sky-800'}`}>
                <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
                {nothingSent ? 'Verified from every ledger entry' : 'Each one was sent with your consent'}
              </p>
              {counters.rawSentDemo > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">+ {plural(counters.rawSentDemo, 'demo row')} sent with consent</p>
              )}
            </div>

            <dl className="mt-2.5 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-white/85 px-3 py-2 ring-1 ring-sky-200/65">
                <dt className="text-[11px] text-slate-500">Merchant names</dt>
                <dd className="text-base font-bold text-slate-900 tabular-nums">{counters.merchantNamesShared}</dd>
              </div>
              <div className="rounded-xl bg-white/85 px-3 py-2 ring-1 ring-sky-200/65">
                <dt className="text-[11px] text-slate-500">Cloud requests</dt>
                <dd className="text-base font-bold text-slate-900 tabular-nums">{counters.cloudRequests}</dd>
              </div>
            </dl>

            <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-900/15">
              <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal aria-hidden className="size-3 text-sky-400" />
                  Last cloud payload
                </span>
                {lastCloud && <CopyButton text={lastCloud.payloadPreview} label="Copy" dark />}
              </div>
              <pre className="code-inspector max-h-36 overflow-auto p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {lastCloud ? lastCloud.payloadPreview : <span className="text-slate-400">Nothing has left this device yet.</span>}
              </pre>
            </div>
          </section>

          {/* RECENT ACTIVITY */}
          <section aria-label="Recent activity" className="border-t border-slate-200/80 bg-white px-4 py-3.5">
            <h3 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Recent activity</h3>
            {recent.length === 0 ? (
              <p className="mt-2 rounded-xl bg-slate-50 px-3 py-3 text-center text-xs text-slate-500 ring-1 ring-slate-200/60">
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
                          <span className="truncate font-semibold text-slate-900">{e.feature}</span>
                          <time className="ml-auto shrink-0 text-[11px] text-slate-400 tabular-nums">{formatTime(e.timestamp)}</time>
                        </div>
                        <span className={`block text-[11px] font-medium ${source.className}`}>{source.text}</span>
                        <p className="mt-0.5 line-clamp-2 font-mono text-[11px] text-slate-500">{e.payloadPreview}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <a
              href="#/ledger"
              className="mt-3.5 flex items-center justify-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-ink-800 ring-1 ring-slate-200/80 transition-colors hover:bg-ink-50 hover:ring-ink-200"
            >
              Open the full Privacy Ledger <ArrowRight aria-hidden className="size-3.5" />
            </a>
          </section>
        </div>
      )}
    </aside>
  );
}
