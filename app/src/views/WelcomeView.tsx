import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Check,
  Cloud,
  Cpu,
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
import { ModelStatusCard } from '../components/ModelStatus';
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
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(62rem_34rem_at_88%_-12%,rgba(14,165,233,0.12),transparent_65%),radial-gradient(46rem_28rem_at_6%_112%,rgba(16,185,129,0.12),transparent_65%)]"
        />
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
        />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:py-20">
          <div className="fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-emerald-200/90">
              <span aria-hidden className="size-2 rounded-full bg-emerald-500" />
              <Cpu aria-hidden className="size-3.5 text-emerald-700" />
              For freelancers · Gemini Nano in Chrome
            </p>

            <h1 className="mt-5 text-4xl leading-[1.06] font-bold tracking-[-0.025em] text-slate-950 text-balance sm:text-[3.1rem]">
              Sort business from personal spending.{' '}
              <span className="text-slate-400">Without uploading your bank statement.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-slate-600">
              Every transaction is labeled on your laptop. The cloud AI only ever sees totals, and you can inspect every request that leaves this device.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {hasData ? (
                <>
                  <Button variant="primary" className="group min-h-12 px-5 text-[15px]" onClick={() => navigate('transactions')}>
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
                  <Button variant="primary" className="group min-h-12 px-5 text-[15px]" onClick={() => void onDemo()} disabled={starting}>
                    <Play aria-hidden className="size-4 fill-current" />
                    {starting ? 'Loading demo…' : 'Try it with demo data'}
                  </Button>
                  <Button className="min-h-12 px-5 text-[15px]" onClick={() => navigate('import')}>
                    <FileUp aria-hidden className="size-4 text-ink-700" /> Import your CSV
                  </Button>
                </>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
                Could not load the demo: {error}
              </p>
            )}

            <ul className="mt-8 grid max-w-lg grid-cols-2 gap-2.5 text-sm text-slate-700">
              {PROMISES.map((p) => (
                <li
                  key={p.text}
                  className="flex items-center gap-2.5 rounded-xl bg-white/80 px-3 py-2 text-xs font-medium text-slate-700 ring-1 ring-slate-200/75"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70">
                    <p.icon aria-hidden className="size-3.5" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-12 px-4 py-14 sm:px-6">
        <HowItWorks />

        <section aria-labelledby="setup" className="space-y-5">
          <div>
            <p className="text-xs font-bold tracking-wider text-ink-700 uppercase">Local setup</p>
            <h2 id="setup" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Set up in a minute
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

const PREVIEW_ROWS = [
  { initials: 'AC', merchant: 'Adobe Creative Cloud', category: 'Software & Subscriptions', amount: '−$59.99', label: 'Business', tone: 'business', by: 'On-device AI' },
  { initials: 'WF', merchant: 'Whole Foods', category: 'Groceries', amount: '−$86.42', label: 'Personal', tone: 'personal', by: 'On-device AI' },
  { initials: 'ST', merchant: 'Stripe · Acme Studio', category: 'Income', amount: '+$2,400.00', label: 'Business', tone: 'business', by: 'Rule' },
  { initials: 'SB', merchant: 'Starbucks', category: 'Meals', amount: '−$6.45', label: 'Decide', tone: 'review', by: 'Mixed-use rule' },
] as const;

const TONE = {
  business: 'bg-ink-800 text-white shadow-xs',
  personal: 'bg-slate-200/90 text-slate-800',
  review: 'bg-amber-100 text-amber-950 ring-1 ring-amber-300/90',
};

/** A picture of the product with demo merchants, so the first screen shows what you get. */
function ProductPreview() {
  return (
    <figure className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-emerald-200/35 via-sky-200/25 to-ink-100/40 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.05),0_24px_48px_-16px_rgba(15,23,42,0.16)]">
        {/* Window chrome */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 bg-slate-50/90 px-4 py-2.5">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80">
            <Lock aria-hidden className="size-3 text-emerald-600" />
            private-ledger · local
          </span>
          <Badge tone="device">
            <Cpu aria-hidden className="size-3" /> On device
          </Badge>
        </div>

        {/* Rows */}
        <ul className="divide-y divide-slate-100 bg-white">
          {PREVIEW_ROWS.map((row) => (
            <li
              key={row.merchant}
              className={`flex items-center gap-3 px-4 py-3.5 ${row.tone === 'review' ? 'bg-amber-50/35' : ''}`}
            >
              <span
                aria-hidden
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                  row.tone === 'business'
                    ? 'bg-ink-50 text-ink-800 ring-1 ring-ink-200/70'
                    : row.tone === 'review'
                      ? 'bg-amber-100/80 text-amber-900 ring-1 ring-amber-300/70'
                      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
                }`}
              >
                {row.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{row.merchant}</p>
                <p className="truncate text-xs text-slate-500">
                  {row.category} · {row.by}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  row.amount.startsWith('+') ? 'text-emerald-700' : 'text-slate-900'
                }`}
              >
                {row.amount}
              </span>
              <span className={`w-[4.75rem] rounded-lg py-1 text-center text-[11px] font-semibold ${TONE[row.tone]}`}>
                {row.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Mini live data boundary split */}
        <div className="relative grid grid-cols-2 border-t border-slate-200/80">
          <div className="flex items-center gap-2.5 bg-gradient-to-br from-emerald-50/90 to-emerald-50/40 px-4 py-3.5 text-emerald-950">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-2xs ring-1 ring-emerald-200/80">
              <Laptop aria-hidden className="size-4" />
            </span>
            <div className="leading-tight">
              <span className="block text-base font-bold tabular-nums">40</span>
              <span className="text-[11px] font-medium text-emerald-800">kept on device</span>
            </div>
          </div>

          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm ring-2 ring-white"
          >
            <Lock className="size-3" />
          </span>

          <div className="flex items-center gap-2.5 border-l border-dashed border-slate-300 bg-gradient-to-br from-sky-50/90 to-sky-50/40 px-4 py-3.5 pl-5 text-sky-950">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 shadow-2xs ring-1 ring-sky-200/80">
              <Cloud aria-hidden className="size-4" />
            </span>
            <div className="leading-tight">
              <span className="block text-base font-bold text-emerald-700 tabular-nums">0</span>
              <span className="text-[11px] font-medium text-sky-900">raw rows sent</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck aria-hidden className="size-3.5 text-emerald-700" />
        Preview with the 40-row synthetic demo statement
      </figcaption>
    </figure>
  );
}

const STEPS = [
  {
    zone: 'device' as const,
    icon: FileUp,
    title: 'Your CSV stays in this browser',
    detail: 'Parsed locally and stored only in IndexedDB. No upload, no bank login, no backend server.',
  },
  {
    zone: 'device' as const,
    icon: ListChecks,
    title: 'Gemini Nano labels each merchant',
    detail: 'Rules settle transfers, fees, and mixed-use stores first. You decide the unclear ones with one keystroke.',
  },
  {
    zone: 'cloud' as const,
    icon: Cloud,
    title: 'The cloud AI only sees totals',
    detail: 'It asks for them through functions that run locally on your device, and every request is logged verbatim.',
  },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wider text-emerald-700 uppercase">Hybrid architecture</p>
          <h2 id="how-it-works" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            How the data boundary works
          </h2>
        </div>
        <p className="text-sm text-slate-500">Inference mode follows the sensitivity of your data.</p>
      </div>

      <ol className="mt-5 grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const isDevice = step.zone === 'device';
          return (
            <li
              key={step.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_6px_20px_-6px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-8px_rgba(15,23,42,0.1)]"
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-1 ${isDevice ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-sky-500 to-sky-400'}`}
              />
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex size-11 items-center justify-center rounded-xl ring-1 ring-inset ${
                    isDevice ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' : 'bg-sky-50 text-sky-700 ring-sky-200/80'
                  }`}
                >
                  <step.icon aria-hidden className="size-5" />
                </span>
                <Badge tone={isDevice ? 'device' : 'cloud'}>
                  Step {i + 1} · {isDevice ? 'On this device' : 'Cloud'}
                </Badge>
              </div>
              <p className="mt-5 text-base font-semibold tracking-tight text-slate-950">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.detail}</p>
            </li>
          );
        })}
      </ol>
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
        <span className="flex size-10 items-center justify-center rounded-xl bg-ink-50 text-ink-800 ring-1 ring-ink-200/80">
          <Laptop aria-hidden className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold text-slate-900">Your business</h3>
          <p className="text-xs text-slate-500">Context for the on-device model</p>
        </div>
      </div>

      <label htmlFor="profile" className="mt-4 block text-sm text-slate-600">
        What does your business pay for? Pick a quick starter or describe your work:
      </label>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {PROFILE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void persist(preset.text)}
            className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/90 transition-colors hover:bg-ink-50 hover:text-ink-900 hover:ring-ink-200"
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
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm leading-relaxed text-slate-900 transition-colors placeholder:text-slate-400 focus:border-ink-700 focus:bg-white focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Lock aria-hidden className="size-3.5 text-emerald-700" /> Stays on this device. Never sent to the cloud.
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
