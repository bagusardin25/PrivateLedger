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
  Sparkles,
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
  { icon: WifiOff, text: 'Works offline' },
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
      {/* EDITORIAL HERO */}
      <section className="relative overflow-hidden border-b border-stone-200/80 bg-[#fdfcfa] dark:border-white/[0.08] dark:bg-[#090a0f]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(64rem_38rem_at_88%_-15%,rgba(85,92,224,0.11),transparent_60%),radial-gradient(48rem_30rem_at_6%_112%,rgba(15,118,110,0.09),transparent_60%)] dark:bg-[radial-gradient(64rem_38rem_at_88%_-15%,rgba(129,140,248,0.15),transparent_60%),radial-gradient(48rem_30rem_at_6%_112%,rgba(45,212,191,0.11),transparent_60%)]"
        />
        <div
          aria-hidden
          className="bg-fine-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_84%)]"
        />

        <div className="relative mx-auto grid max-w-[1260px] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] lg:py-20">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-teal-900 shadow-[0_1px_3px_rgba(24,24,27,0.05)] ring-1 ring-teal-200/85 dark:bg-white/[0.05] dark:text-teal-300 dark:ring-teal-500/30">
              <span className="relative flex size-2">
                <span aria-hidden className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:hidden" />
                <span aria-hidden className="relative inline-flex size-2 rounded-full bg-teal-600 dark:bg-teal-400" />
              </span>
              <Cpu aria-hidden className="size-3.5 text-teal-700 dark:text-teal-400" />
              Hybrid AI · Gemini Nano in Chrome
            </div>

            <h1 className="mt-5 text-4xl leading-[1.06] font-extrabold tracking-[-0.03em] text-zinc-950 text-balance sm:text-[3.25rem] dark:text-white">
              Sort business from personal spending.{' '}
              <span className="bg-gradient-to-r from-ink-800 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-teal-300">
                Your bank statement never leaves your laptop.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-[17px] dark:text-zinc-400">
              Gemini Nano labels every row locally inside Chrome. The cloud model only ever receives totals — and a live Data Boundary lets you inspect
              every byte that leaves.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {hasData ? (
                <>
                  <Button variant="primary" className="group min-h-12 px-6 text-[15px]" onClick={() => navigate('transactions')}>
                    Continue with {counts.total.toLocaleString('en-US')} transactions
                    <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                  <Button className="min-h-12 px-5 text-[15px]" onClick={() => void onDemo()} disabled={starting}>
                    <RotateCcw aria-hidden className="size-4" />
                    {starting ? 'Loading demo…' : counts.demo > 0 ? 'Restart demo' : 'Try demo data'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" className="group min-h-12 px-6 text-[15px]" onClick={() => void onDemo()} disabled={starting}>
                    <Play aria-hidden className="size-4 fill-current" />
                    {starting ? 'Loading demo…' : 'Try it with demo data'}
                    {!starting && <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />}
                  </Button>
                  <Button className="min-h-12 px-5 text-[15px]" onClick={() => navigate('import')}>
                    <FileUp aria-hidden className="size-4 text-ink-700 dark:text-indigo-300" /> Import your CSV
                  </Button>
                </>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/70 dark:text-rose-200 dark:ring-rose-800"
              >
                Could not load the demo: {error}
              </p>
            )}

            <ul className="mt-8 grid max-w-lg grid-cols-2 gap-2.5 text-sm">
              {PROMISES.map((p) => (
                <li
                  key={p.text}
                  className="flex items-center gap-2.5 rounded-xl bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 shadow-2xs ring-1 ring-stone-200/85 dark:bg-white/[0.04] dark:text-zinc-200 dark:ring-white/[0.08]"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800 ring-1 ring-teal-200/80 dark:bg-teal-950/80 dark:text-teal-300 dark:ring-teal-700/60">
                    <p.icon aria-hidden className="size-3.5" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          <InteractiveShowcase />
        </div>
      </section>

      <div className="mx-auto max-w-[1260px] space-y-14 px-4 py-14 sm:px-6">
        <ArchitectureBento />

        <section aria-labelledby="setup" className="space-y-5">
          <div>
            <p className="text-xs font-bold tracking-wider text-ink-600 uppercase dark:text-indigo-400">Local setup</p>
            <h2 id="setup" className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Ready in a minute
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
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

const CLOUD_TOTALS_SAMPLE = `{
  "period": "2026-10",
  "businessExpenses": {
    "Software & Subscriptions": 149.99,
    "Travel": 312.40,
    "Office & Coworking": 275.00
  },
  "rawTransactionsIncluded": 0,
  "merchantNamesIncluded": 0
}`;

/** Interactive 3-tab product showcase right in the hero so visitors grasp all 3 pillars immediately. */
function InteractiveShowcase() {
  const [tab, setTab] = useState<ShowcaseTab>('local');
  const [coffeeChoice, setCoffeeChoice] = useState<'unsure' | 'business' | 'personal'>('unsure');

  return (
    <figure className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-gradient-to-tr from-indigo-300/25 via-violet-200/20 to-teal-200/25 blur-3xl dark:from-indigo-500/18 dark:via-violet-500/12 dark:to-teal-500/14"
      />

      <div className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_6px_18px_rgba(24,24,27,0.06),0_28px_60px_-18px_rgba(28,31,74,0.18)] dark:border-white/10 dark:bg-[#12131c] dark:shadow-[0_28px_64px_-18px_rgba(0,0,0,0.8)]">
        {/* Velvet Obsidian window bar + interactive mode tabs */}
        <div className="border-b border-stone-200/80 bg-gradient-to-r from-[#0e101c] via-[#15182d] to-[#111322] px-4 pt-3 pb-2.5 text-white dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
              <span className="size-2.5 rounded-full bg-white/20" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-medium text-zinc-200 ring-1 ring-white/10">
              <Lock aria-hidden className="size-3 text-teal-400" />
              private-ledger · local
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-teal-300 uppercase">Live preview</span>
          </div>

          <div role="tablist" aria-label="Product capability preview" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.06] p-1">
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
                  className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all ${
                    active ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    aria-hidden
                    className={`size-3.5 ${
                      active ? (id === 'local' ? 'text-teal-700' : id === 'cloud' ? 'text-indigo-600' : 'text-rose-600') : ''
                    }`}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Tab Body */}
        <div className="min-h-[17.5rem] bg-white dark:bg-[#12131c]">
          {tab === 'local' && (
            <ul className="divide-y divide-stone-100 dark:divide-white/[0.06]">
              {DEMO_PREVIEW_ROWS.map((row) => (
                <li key={row.merchant} className="flex items-center gap-3 px-4 py-3.5">
                  <MerchantAvatar name={row.merchant} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.merchant}</p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {row.category} · {row.by}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      row.amount.startsWith('+') ? 'text-teal-700 dark:text-teal-400' : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {row.amount}
                  </span>
                  <span
                    className={`w-[4.75rem] rounded-lg py-1 text-center text-[11px] font-semibold ${
                      row.type === 'business'
                        ? 'bg-ink-800 text-white dark:bg-indigo-400 dark:text-zinc-950'
                        : 'bg-stone-100 text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-300'
                    }`}
                  >
                    {row.type === 'business' ? 'Business' : 'Personal'}
                  </span>
                </li>
              ))}
              <li
                className={`flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors ${
                  coffeeChoice === 'unsure' ? 'bg-amber-50/45 dark:bg-amber-950/20' : ''
                }`}
              >
                <MerchantAvatar name="Starbucks" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">Starbucks</p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {coffeeChoice === 'unsure' ? 'Mixed-use · tap to try sorting' : 'Remembered locally for Starbucks'}
                  </p>
                </div>
                <span className="text-sm font-bold text-zinc-900 tabular-nums dark:text-zinc-100">−$6.45</span>
                <div className="inline-flex gap-0.5 rounded-lg bg-stone-100 p-0.5 ring-1 ring-stone-200/90 dark:bg-white/[0.06] dark:ring-white/10">
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('business')}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      coffeeChoice === 'business'
                        ? 'bg-ink-800 text-white shadow-2xs dark:bg-indigo-400 dark:text-zinc-950'
                        : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10'
                    }`}
                  >
                    Biz
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('personal')}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      coffeeChoice === 'personal'
                        ? 'bg-zinc-700 text-white shadow-2xs dark:bg-zinc-500'
                        : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10'
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
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Exact payload sent for Monthly Summary</p>
                <Badge tone="cloud">PREFER_IN_CLOUD</Badge>
              </div>
              <PayloadViewer
                title="Outbound cloud request (totals only)"
                content={CLOUD_TOTALS_SAMPLE}
                accent="cloud"
                maxHeightClass="max-h-48"
                showCopy={false}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                No bank descriptions, dates, client names, or individual line items ever cross the boundary.
              </p>
            </div>
          )}

          {tab === 'guard' && (
            <div className="space-y-3 p-4">
              <div className="flex flex-col items-end gap-1">
                <p className="max-w-[90%] rounded-2xl rounded-br-sm bg-rose-50 px-3.5 py-2 font-mono text-xs text-rose-950 ring-1 ring-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800">
                  10/12 DELTA AIR LINES -312.40 — is this deductible?
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  <Ban aria-hidden className="size-3" /> Not sent · 0 bytes left device
                </span>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-rose-50/90 p-3.5 text-xs leading-relaxed text-rose-950 ring-1 ring-rose-300/80 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-800/80">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                  <Ban aria-hidden className="size-4" />
                </span>
                <div>
                  <p className="font-bold">Blocked on this device by the outgoing guard.</p>
                  <p className="mt-0.5 opacity-90">Detected amount with date and merchant from your data. Ask about category totals instead.</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-stone-200/85 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10">
                <span>Guard runs locally with rules + Gemini Nano</span>
                <Badge tone="device">ONLY_ON_DEVICE</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Signature split data boundary footer */}
        <div className="relative grid grid-cols-2 border-t border-stone-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-teal-50/90 to-teal-50/30 px-4 py-3 text-teal-950 dark:from-teal-950/45 dark:to-[#12131c] dark:text-teal-100">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-teal-800 shadow-2xs ring-1 ring-teal-200/80 dark:bg-[#0b0c14] dark:text-teal-400 dark:ring-teal-800/60">
              <Laptop aria-hidden className="size-4" />
            </span>
            <div className="leading-tight">
              <span className="block text-base font-extrabold tabular-nums">40</span>
              <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">kept on device</span>
            </div>
          </div>

          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#141628] text-teal-400 shadow-md ring-2 ring-white dark:ring-[#12131c]"
          >
            <Lock className="size-3.5" />
          </span>

          <div className="flex items-center gap-2.5 border-l border-dashed border-stone-300 bg-gradient-to-br from-indigo-50/85 to-indigo-50/30 px-4 py-3 pl-6 text-indigo-950 dark:border-white/15 dark:from-indigo-950/45 dark:to-[#12131c] dark:text-indigo-100">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-2xs ring-1 ring-indigo-200/80 dark:bg-[#0b0c14] dark:text-indigo-400 dark:ring-indigo-800/60">
              <Cloud aria-hidden className="size-4" />
            </span>
            <div className="leading-tight">
              <span className="block text-base font-extrabold text-teal-700 tabular-nums dark:text-teal-400">0</span>
              <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300">raw rows sent</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <ShieldCheck aria-hidden className="size-3.5 text-teal-700 dark:text-teal-400" />
        Switch tabs above to inspect how Private Ledger separates local data from cloud math
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

const LOCAL_TOOL_SNIPPET = `// Cloud calls a local function running in your browser
cloud.call("get_spending_by_category", { period: "2026-10" })

// Device queries IndexedDB and returns ONLY totals
← { "Software": 149.99, "Travel": 312.40, "Meals": 42.15 }`;

/** Asymmetric Bento Grid communicating the hybrid privacy architecture visually. */
function ArchitectureBento() {
  return (
    <section aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider text-teal-700 uppercase dark:text-teal-400">Hybrid architecture</p>
          <h2 id="how-it-works" className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl dark:text-white">
            How the data boundary works
          </h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Every AI model mode follows the sensitivity of the data it handles.</p>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        {/* Bento 1: Local pipeline (7 cols) */}
        <article className="relative overflow-hidden rounded-2xl border border-teal-200/75 bg-gradient-to-br from-teal-50/65 via-white to-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.03),0_10px_28px_-10px_rgba(15,118,110,0.08)] lg:col-span-7 dark:border-teal-800/45 dark:from-teal-950/30 dark:via-[#12131c] dark:to-[#12131c]">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="device">
              <Laptop aria-hidden className="size-3" /> Stays on your laptop
            </Badge>
            <code className="rounded-md bg-teal-100/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-900 dark:bg-teal-950 dark:text-teal-300">
              ONLY_ON_DEVICE
            </code>
          </div>
          <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Parse, normalize, and label rows inside Chrome
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Deterministic rules settle transfers, fees, and mixed-use stores immediately. Unique merchants stream through Gemini Nano in Chrome and
            never leave IndexedDB.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.label}
                className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2.5 text-xs font-semibold text-zinc-800 shadow-2xs ring-1 ring-teal-200/75 dark:bg-[#0b0c14]/70 dark:text-zinc-200 dark:ring-teal-800/45"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  <step.icon aria-hidden className="size-3.5" />
                </span>
                <span className="truncate">
                  <span className="mr-1 text-teal-700/80 dark:text-teal-400">{i + 1}.</span>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Bento 2: Auditable proof (5 cols) */}
        <article className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/85 bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.03),0_10px_28px_-10px_rgba(24,24,27,0.06)] lg:col-span-5 dark:border-white/[0.08] dark:bg-[#12131c]">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Badge tone="ink">
                <ShieldCheck aria-hidden className="size-3" /> Auditable proof
              </Badge>
              <span className="text-[11px] font-semibold text-zinc-400">Not a promise</span>
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">A boundary you can inspect</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              Every AI request writes an immutable record to the Privacy Ledger with its exact payload, mode, model, and size — exportable as JSON.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-xl bg-stone-50/95 px-4 py-3 ring-1 ring-stone-200/85 dark:bg-[#0b0c14]/70 dark:ring-white/[0.08]">
            <span className="text-4xl leading-none font-extrabold text-teal-700 tabular-nums dark:text-teal-400">0</span>
            <div className="text-xs leading-snug text-zinc-600 dark:text-zinc-300">
              <strong className="block font-semibold text-zinc-900 dark:text-white">Raw transactions sent</strong>
              Computed directly from ledger records + enforced by CSP
            </div>
          </div>
        </article>

        {/* Bento 3: Full-width Velvet Obsidian showcase card (12 cols) */}
        <article className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-[#0e101c] via-[#14172b] to-[#0b0c14] p-6 text-white shadow-[0_18px_48px_-14px_rgba(12,13,36,0.55)] sm:p-7 lg:col-span-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_100%_0%,rgba(129,140,248,0.18),transparent_60%),radial-gradient(30rem_16rem_at_0%_100%,rgba(45,212,191,0.12),transparent_60%)]"
          />
          <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-200 ring-1 ring-indigo-400/30">
                  <Sparkles aria-hidden className="size-3" /> Cloud thinks · Device holds data
                </span>
                <code className="rounded-md bg-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-zinc-300">ONLY_IN_CLOUD + Local Functions</code>
              </div>
              <h3 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
                Ask the Advisor anything about your totals
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
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
        <span className="flex size-10 items-center justify-center rounded-xl bg-ink-50 text-ink-800 ring-1 ring-ink-200/80 dark:bg-indigo-950/70 dark:text-indigo-300 dark:ring-indigo-700/60">
          <Laptop aria-hidden className="size-5" />
        </span>
        <div>
          <h3 className="font-bold text-zinc-950 dark:text-white">Your business</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Private context for the on-device model</p>
        </div>
      </div>

      <label htmlFor="profile" className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
        What does your business pay for? Pick a starter or describe your work:
      </label>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {PROFILE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void persist(preset.text)}
            className="rounded-full bg-stone-50 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-stone-200/90 transition-colors hover:bg-ink-50 hover:text-ink-900 hover:ring-ink-200 dark:bg-white/[0.05] dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-300"
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
        className="mt-3 w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-sm leading-relaxed text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-ink-700 focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#0b0c14]/70 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:bg-[#0b0c14]"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <Lock aria-hidden className="size-3.5 text-teal-700 dark:text-teal-400" /> Stays on this device. Never sent to the cloud.
        </p>
        <Button
          variant={saved ? 'device' : dirty ? 'primary' : 'ghost'}
          className="min-h-8 shrink-0 rounded-lg px-3 text-xs"
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
