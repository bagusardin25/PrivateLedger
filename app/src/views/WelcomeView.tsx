import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Ban,
  Check,
  Cloud,
  Cpu,
  Database,
  FileUp,
  Laptop,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  UploadCloud,
  WifiOff,
} from 'lucide-react';
import { useState } from 'react';
import { MerchantAvatar } from '../components/MerchantAvatar';
import { ModelStatusCard } from '../components/ModelStatus';
import { PayloadViewer } from '../components/PayloadViewer';
import { Badge, Button, Card } from '../components/ui';
import { navigate, startDemo } from '../lib/state/actions';
import { db } from '../lib/data/db';

const PROMISES = [
  { icon: UploadCloud, text: 'Nothing uploaded' },
  { icon: Lock, text: 'No account needed' },
  { icon: WifiOff, text: 'Labeling works offline' },
  { icon: ScrollText, text: 'Every cloud call logged' },
];

export function WelcomeView() {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();
  const counts = useLiveQuery(
    async () => {
      const all = await db.transactions.toArray();
      return { total: all.length, demo: all.filter((t) => t.isDemo).length };
    },
    [],
    { total: 0, demo: 0 },
  );

  const onDemo = async () => {
    setStarting(true);
    setError(undefined);
    try {
      await startDemo();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const hasData = counts.total > 0;

  return (
    <div>
      {/* MINIMALIST EDITORIAL HERO */}
      <section className="border-b border-zinc-200/80 bg-white dark:border-white/[0.07] dark:bg-[#09090b]">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <div className="fade-up min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-zinc-300">
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              On-device Gemini Nano · Firebase AI Logic
            </p>

            <h1 className="mt-6 text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-zinc-950 text-balance sm:text-[2.85rem] dark:text-white">
              Sort business from personal spending.{' '}
              <span className="text-zinc-500 dark:text-zinc-400">Your bank statement never leaves your laptop.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
              Gemini Nano labels every row locally inside Chrome. The cloud model only ever receives totals — and a live Data Boundary lets you inspect
              every byte that leaves.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {hasData ? (
                <>
                  <Button variant="primary" className="group min-h-11 px-5 text-sm" onClick={() => navigate('transactions')}>
                    Continue with {counts.total.toLocaleString('en-US')} transactions
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button className="min-h-11 px-4 text-sm" onClick={() => void onDemo()} disabled={starting}>
                    <RotateCcw aria-hidden className="size-3.5" />
                    {starting ? 'Loading demo…' : counts.demo > 0 ? 'Restart demo' : 'Try demo data'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" className="group min-h-11 px-5 text-sm" onClick={() => void onDemo()} disabled={starting}>
                    <Play aria-hidden className="size-3.5 fill-current" />
                    {starting ? 'Loading demo…' : 'Try it with demo data'}
                    {!starting && <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />}
                  </Button>
                  <Button className="min-h-11 px-4 text-sm" onClick={() => navigate('import')}>
                    <FileUp aria-hidden className="size-3.5 text-zinc-500 dark:text-zinc-400" /> Import your CSV
                  </Button>
                </>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
              >
                Could not load the demo: {error}
              </p>
            )}

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 border-t border-zinc-100 pt-6 text-xs text-zinc-500 dark:border-white/[0.06] dark:text-zinc-400">
              {PROMISES.map((p) => (
                <li key={p.text} className="inline-flex items-center gap-1.5">
                  <p.icon aria-hidden className="size-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <InteractiveShowcase />
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-14 px-4 py-14 sm:px-6">
        <ArchitectureSection />

        <section aria-labelledby="setup" className="space-y-5">
          <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Local setup</p>
            <h2 id="setup" className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
              Ready in a minute
            </h2>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
            <Card>
              <ModelStatusCard />
            </Card>
            <Card>
              <ProfileEditor />
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

type ShowcaseTab = 'local' | 'cloud' | 'guard';

const DEMO_PREVIEW_ROWS = [
  { merchant: 'Adobe Creative Cloud', category: 'Software & Subscriptions', amount: '−$59.99', type: 'business' as const, by: 'On-device AI' },
  { merchant: 'Whole Foods Market', category: 'Groceries', amount: '−$86.42', type: 'personal' as const, by: 'On-device AI' },
  { merchant: 'Stripe · Acme Studio', category: 'Income', amount: '+$2,400.00', type: 'business' as const, by: 'Rule' },
];

// Same text and field names as summaryPrompt() in lib/ai/reporter.ts builds; only the figures are examples.
const CLOUD_TOTALS_SAMPLE = `Monthly totals (no individual transactions):
{
  "period": "2026-10",
  "currency": "USD",
  "totals": {
    "business_spending": 737.39,
    "personal_spending": 2412.86,
    "business_income": 5450,
    "not_sorted_count": 0
  },
  "business_spending_by_category": [
    { "category": "Office & Coworking", "total": 350, "count": 1 },
    { "category": "Travel", "total": 312.4, "count": 1 },
    { "category": "Software & Subscriptions", "total": 74.99, "count": 2 }
  ]
}`;

/** Interactive 3-tab product showcase right in the hero so visitors grasp all 3 pillars immediately. */
function InteractiveShowcase() {
  const [tab, setTab] = useState<ShowcaseTab>('local');
  const [coffeeChoice, setCoffeeChoice] = useState<'unsure' | 'business' | 'personal'>('unsure');

  return (
    <figure className="relative min-w-0">
      <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_12px_36px_-16px_rgba(0,0,0,0.08)] dark:border-white/[0.09] dark:bg-[#111114] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.75)]">
        {/* Clean architectural window bar + mode tabs */}
        <div className="border-b border-zinc-100 bg-zinc-50/70 px-4 pt-3 pb-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              <Lock aria-hidden className="size-3 text-emerald-600 dark:text-emerald-400" />
              private-ledger · local
            </span>
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Interactive preview</span>
          </div>

          <div
            role="tablist"
            aria-label="Product capability preview"
            className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-zinc-200/60 p-0.5 dark:bg-white/[0.05]"
          >
            {(
              [
                ['local', 'On-device AI', Cpu],
                ['cloud', 'Totals only', Cloud],
                ['guard', 'Leak guard', Ban],
              ] as const
            ).map(([id, label, Icon]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-white text-zinc-950 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:bg-[#1b1b20] dark:text-white'
                      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon
                    aria-hidden
                    className={`size-3.5 ${
                      active
                        ? id === 'local'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : id === 'cloud'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Tab Body */}
        <div className="min-h-[16.75rem] bg-white dark:bg-[#111114]">
          {tab === 'local' && (
            <ul className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
              {DEMO_PREVIEW_ROWS.map((row) => (
                <li key={row.merchant} className="flex items-center gap-3 px-4 py-3">
                  <MerchantAvatar name={row.merchant} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-zinc-950 dark:text-zinc-100">{row.merchant}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {row.category} · {row.by}
                    </p>
                  </div>
                  <span
                    className={`text-[13px] font-medium tabular-nums ${
                      row.amount.startsWith('+') ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {row.amount}
                  </span>
                  <span
                    className={`w-[4.5rem] rounded-md py-1 text-center text-[11px] font-medium ${
                      row.type === 'business'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300'
                    }`}
                  >
                    {row.type === 'business' ? 'Business' : 'Personal'}
                  </span>
                </li>
              ))}
              <li
                className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors ${
                  coffeeChoice === 'unsure' ? 'bg-amber-50/40 dark:bg-amber-500/[0.05]' : ''
                }`}
              >
                <MerchantAvatar name="Starbucks" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-950 dark:text-zinc-100">Starbucks</p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {coffeeChoice === 'unsure' ? 'Mixed-use · try sorting' : 'Remembered locally for Starbucks'}
                  </p>
                </div>
                <span className="text-[13px] font-medium text-zinc-900 tabular-nums dark:text-zinc-100">−$6.45</span>
                <div className="inline-flex gap-0.5 rounded-md border border-zinc-200/80 bg-zinc-50 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('business')}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      coffeeChoice === 'business'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    Biz
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('personal')}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      coffeeChoice === 'personal'
                        ? 'bg-zinc-700 text-white dark:bg-zinc-500'
                        : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                    }`}
                  >
                    Pers
                  </button>
                </div>
              </li>
            </ul>
          )}

          {tab === 'cloud' && (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">What the cloud receives for a monthly summary</p>
                <Badge tone="cloud">PREFER_IN_CLOUD</Badge>
              </div>
              <PayloadViewer
                title="Example request, in the same format as the real one"
                content={CLOUD_TOTALS_SAMPLE}
                accent="cloud"
                maxHeightClass="max-h-44"
                showCopy={false}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No bank description, transaction date, client name, or line item is in this request. After a real run, the Privacy Ledger
                shows the exact one.
              </p>
            </div>
          )}

          {tab === 'guard' && (
            <div className="space-y-3 p-4">
              <div className="flex flex-col items-end gap-1">
                <p className="max-w-[92%] rounded-xl rounded-br-sm border border-rose-200 bg-rose-50/70 px-3 py-2 font-mono text-xs text-rose-950 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                  10/12 DELTA AIR LINES -312.40 — is this deductible?
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  <Ban aria-hidden className="size-3" /> Not sent · 0 bytes left device
                </span>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-200/80 bg-rose-50/50 p-3 text-xs leading-relaxed text-rose-950 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-semibold">Blocked on this device by the outgoing guard.</p>
                  <p className="mt-0.5 opacity-90">Detected amount with date and merchant from your data. Ask about category totals instead.</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-zinc-400">
                <span>Guard runs locally with rules + Gemini Nano</span>
                <Badge tone="device">ONLY_ON_DEVICE</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Clean hairline split boundary footer */}
        <div className="relative grid grid-cols-2 divide-x divide-zinc-200/80 border-t border-zinc-200/80 bg-zinc-50/60 dark:divide-white/[0.07] dark:border-white/[0.07] dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Laptop aria-hidden className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-zinc-950 tabular-nums dark:text-white">40</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">kept on device</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3">
            <Cloud aria-hidden className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">0</span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">raw rows sent</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <ShieldCheck aria-hidden className="size-3.5 text-emerald-700 dark:text-emerald-400" />
        Switch tabs above to inspect how local data stays separated from cloud math
      </figcaption>
    </figure>
  );
}

const PIPELINE_STEPS = [
  { icon: FileUp, label: 'Bank CSV' },
  { icon: ListChecks, label: 'Local rules' },
  { icon: Cpu, label: 'Gemini Nano' },
  { icon: Database, label: 'IndexedDB' },
];

// The function name, arguments, and answer use the real format from lib/ai/localFunctions.ts; the figures are examples.
const LOCAL_TOOL_SNIPPET = `// The cloud model asks for a function that runs in your browser
get_spending_by_category({ "period": "2026-10", "type": "business" })

// Your device reads IndexedDB and answers with totals only
{ "period": "2026-10", "type": "business", "currency": "USD", "totals": [
  { "category": "Office & Coworking", "total": 350, "count": 1 },
  { "category": "Travel", "total": 312.4, "count": 1 } ] }`;

/** Unified architectural hairline grid explaining the hybrid data boundary. */
function ArchitectureSection() {
  return (
    <section aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Hybrid architecture</p>
          <h2 id="how-it-works" className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">
            How the data boundary works
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every AI model mode follows the sensitivity of the data it handles.</p>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        {/* Card 1: Local pipeline (7 cols) */}
        <article className="min-w-0 rounded-xl border border-zinc-200/80 bg-white p-6 lg:col-span-7 dark:border-white/[0.08] dark:bg-[#111114]">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="device">
              <Laptop aria-hidden className="size-3" /> Stays on your laptop
            </Badge>
            <code className="font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400">ONLY_ON_DEVICE</code>
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">
            Parse, normalize, and label rows inside Chrome
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Deterministic rules settle transfers, fees, and mixed-use stores immediately. Unique merchants stream through Gemini Nano in Chrome and
            never leave IndexedDB.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.label}
                className="flex items-center gap-2 rounded-lg border border-zinc-200/75 bg-zinc-50/70 px-3 py-2 text-xs font-medium text-zinc-800 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-200"
              >
                <step.icon aria-hidden className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span className="truncate">
                  <span className="mr-1 text-zinc-500 dark:text-zinc-400">{i + 1}.</span>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Card 2: Auditable proof (5 cols) */}
        <article className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-white p-6 lg:col-span-5 dark:border-white/[0.08] dark:bg-[#111114]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Badge tone="neutral">
                <ShieldCheck aria-hidden className="size-3 text-emerald-700 dark:text-emerald-400" /> Auditable proof
              </Badge>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Not a promise</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">A boundary you can inspect</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Every AI request writes a record to the Privacy Ledger with its exact payload, mode, model, and size — exportable as JSON.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-zinc-100 pt-4 dark:border-white/[0.06]">
            <span className="text-3xl leading-none font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">0</span>
            <div className="text-xs leading-snug text-zinc-500 dark:text-zinc-400">
              <strong className="block font-semibold text-zinc-900 dark:text-white">Raw transactions sent</strong>
              Counted from the Privacy Ledger records. On the hosted app, a content security policy also limits which servers the page can
              reach.
            </div>
          </div>
        </article>

        {/* Card 3: Local function calling bridge (12 cols) */}
        <article className="min-w-0 rounded-xl border border-zinc-200/80 bg-white p-6 lg:col-span-12 dark:border-white/[0.08] dark:bg-[#111114]">
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="cloud">
                  <Cloud aria-hidden className="size-3" /> Cloud thinks · Device holds data
                </Badge>
                <code className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">ONLY_IN_CLOUD + Local Functions</code>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 sm:text-xl dark:text-white">
                Ask the Advisor anything about your totals
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                The cloud advisor cannot read your bank statement. It invokes local functions inside your browser that query IndexedDB and return
                aggregated totals only — while an on-device guard blocks accidentally pasted statement rows before they leave.
              </p>
            </div>
            <PayloadViewer
              title="Local function calling bridge"
              content={LOCAL_TOOL_SNIPPET}
              accent="cloud"
              showCopy={false}
              maxHeightClass="max-h-44"
            />
          </div>
        </article>
      </div>
    </section>
  );
}

const PROFILE_PRESETS = [
  { label: 'Designer', text: 'Freelance graphic designer. Business tools: design software, stock photos, coworking desk, portfolio website.' },
  { label: 'Developer', text: 'Independent software consultant. Business tools: cloud hosting, developer software, AI tools, domains, laptop accessories.' },
  { label: 'Writer', text: 'Freelance writer and content strategist. Business tools: writing apps, research subscriptions, web hosting, home office.' },
];

function ProfileEditor() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const [draft, setDraft] = useState<string>();
  const [saved, setSaved] = useState(false);
  const stored = profile?.businessDescription ?? '';
  const value = draft ?? stored;
  const dirty = draft !== undefined && draft.trim() !== stored.trim();

  const persist = async (next: string) => {
    const trimmed = next.trim();
    setDraft(undefined);
    if (trimmed === stored.trim()) return;
    await db.profile.put({ id: 'me', businessDescription: trimmed });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const save = async () => {
    if (draft === undefined) return;
    await persist(draft);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50 text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
          <Laptop aria-hidden className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Your business</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Private context for the on-device model</p>
        </div>
      </div>

      <label htmlFor="profile" className="mt-4 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        What does your business pay for? Pick a starter or describe your work:
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PROFILE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void persist(preset.text)}
            className="rounded-md border border-zinc-200/80 bg-zinc-50/70 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.07] dark:hover:text-white"
          >
            + {preset.label}
          </button>
        ))}
      </div>

      <textarea
        id="profile"
        rows={3}
        value={value}
        onChange={(e) => {
          setSaved(false);
          setDraft(e.target.value);
        }}
        onBlur={() => void save()}
        placeholder="Freelance graphic designer. Business tools: design software, stock photos, coworking desk, portfolio website."
        className="mt-3 w-full rounded-lg border border-zinc-200/90 bg-zinc-50/50 p-3 text-sm leading-relaxed text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white focus:outline-none dark:border-white/[0.09] dark:bg-white/[0.02] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:bg-[#111114]"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Lock aria-hidden className="size-3 text-emerald-700 dark:text-emerald-400" /> Stays on this device. Never sent to the cloud.
        </p>
        <Button
          variant={saved ? 'device' : dirty ? 'primary' : 'ghost'}
          className="min-h-8 shrink-0 px-3 text-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void save()}
          disabled={!dirty && !saved}
        >
          {saved ? (
            <>
              <Check aria-hidden className="size-3.5" /> Saved
            </>
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  );
}
