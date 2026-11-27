import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Cloud, Cpu, FileUp, Laptop, ListChecks, Lock, Play, RotateCcw, ScrollText, UploadCloud, WifiOff } from 'lucide-react';
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
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_-10%,var(--color-sky-50),transparent),radial-gradient(40rem_24rem_at_10%_110%,var(--color-emerald-50),transparent)]"
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-800 shadow-sm ring-1 ring-emerald-200">
              <Cpu aria-hidden className="size-4" /> For freelancers · Gemini Nano in Chrome
            </p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
              Sort business from personal spending. <span className="text-slate-500">Without uploading your bank statement.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-700">
              Every transaction is labeled on your laptop. The cloud AI only ever sees totals, and you can check exactly what it saw.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {hasData ? (
                <>
                  <Button variant="primary" className="min-h-12 px-5 text-base" onClick={() => navigate('transactions')}>
                    Continue with {counts.total.toLocaleString('en-US')} transactions
                    <ArrowRight aria-hidden className="size-4" />
                  </Button>
                  <Button className="min-h-12 px-5 text-base" onClick={() => void onDemo()} disabled={starting}>
                    <RotateCcw aria-hidden className="size-4" />
                    {starting ? 'Loading demo…' : counts.demo > 0 ? 'Restart demo' : 'Try demo data'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" className="min-h-12 px-5 text-base" onClick={() => void onDemo()} disabled={starting}>
                    <Play aria-hidden className="size-4" />
                    {starting ? 'Loading demo…' : 'Try it with demo data'}
                  </Button>
                  <Button className="min-h-12 px-5 text-base" onClick={() => navigate('import')}>
                    <FileUp aria-hidden className="size-4" /> Import your CSV
                  </Button>
                </>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-800">
                Could not load the demo: {error}
              </p>
            )}
            <ul className="mt-8 grid max-w-xl grid-cols-2 gap-x-6 gap-y-3 text-sm text-slate-700">
              {PROMISES.map((p) => (
                <li key={p.text} className="flex items-center gap-2">
                  <p.icon aria-hidden className="size-4 text-emerald-700" /> {p.text}
                </li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] space-y-10 px-4 py-12 sm:px-6">
        <HowItWorks />
        <section aria-labelledby="setup" className="space-y-4">
          <h2 id="setup" className="text-xl font-semibold tracking-tight">
            Set up in a minute
          </h2>
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
  { merchant: 'Adobe Creative Cloud', amount: '−$59.99', label: 'Business', tone: 'business', by: 'On-device AI' },
  { merchant: 'Whole Foods', amount: '−$86.42', label: 'Personal', tone: 'personal', by: 'On-device AI' },
  { merchant: 'Stripe · Acme Studio', amount: '+$2,400.00', label: 'Business', tone: 'business', by: 'Rule' },
  { merchant: 'Starbucks', amount: '−$6.45', label: 'Decide', tone: 'review', by: 'Rule' },
] as const;

const TONE = {
  business: 'bg-ink-800 text-white',
  personal: 'bg-slate-200 text-slate-900',
  review: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
};

/** A picture of the product with demo merchants, so the first screen shows what you get. */
function ProductPreview() {
  return (
    <figure className="relative">
      <div className="rounded-2xl bg-white p-2 shadow-xl ring-1 ring-slate-900/10">
        <div className="rounded-xl bg-slate-50 ring-1 ring-slate-900/5">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
            <span className="text-sm font-semibold">Transactions</span>
            <Badge tone="device">
              <Cpu aria-hidden className="size-3" /> Labeled on this device
            </Badge>
          </div>
          <ul className="divide-y divide-slate-200/70">
            {PREVIEW_ROWS.map((row) => (
              <li key={row.merchant} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.merchant}</p>
                  <p className="text-xs text-slate-600">{row.by}</p>
                </div>
                <span className={`text-sm tabular-nums ${row.amount.startsWith('+') ? 'font-medium text-emerald-800' : 'text-slate-800'}`}>{row.amount}</span>
                <span className={`w-20 rounded-md py-1 text-center text-xs font-semibold ${TONE[row.tone]}`}>{row.label}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 border-t border-slate-200/80 text-sm">
            <div className="flex items-center gap-2 bg-emerald-50/80 px-4 py-3 text-emerald-900">
              <Laptop aria-hidden className="size-4" />
              <span>
                <span className="font-semibold tabular-nums">40</span> kept on device
              </span>
            </div>
            <div className="flex items-center gap-2 bg-sky-50/80 px-4 py-3 text-sky-900">
              <Cloud aria-hidden className="size-4" />
              <span>
                <span className="font-semibold tabular-nums">0</span> raw rows sent
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-slate-600">Preview with the demo data</figcaption>
    </figure>
  );
}

const STEPS = [
  { zone: 'device' as const, icon: FileUp, title: 'Your CSV stays in this browser', detail: 'Parsed locally and stored only in IndexedDB. No upload, no bank login.' },
  { zone: 'device' as const, icon: ListChecks, title: 'Gemini Nano labels each merchant', detail: 'Rules settle transfers, fees, and mixed-use stores first. You decide the unclear ones.' },
  { zone: 'cloud' as const, icon: Cloud, title: 'The cloud AI only sees totals', detail: 'It asks for them through functions that run on your device, and every request is logged.' },
];

function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-xl font-semibold tracking-tight">
        How the data boundary works
      </h2>
      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const isDevice = step.zone === 'device';
          return (
            <li key={step.title} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex size-10 items-center justify-center rounded-lg ${isDevice ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}
                >
                  <step.icon aria-hidden className="size-5" />
                </span>
                <Badge tone={isDevice ? 'device' : 'cloud'}>
                  {i + 1} · {isDevice ? 'On this device' : 'Cloud'}
                </Badge>
              </div>
              <p className="mt-4 font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.detail}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProfileEditor() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const [draft, setDraft] = useState<string>();
  const [saved, setSaved] = useState(false);
  const stored = profile?.businessDescription ?? '';
  const value = draft ?? stored;
  const dirty = draft !== undefined && draft.trim() !== stored.trim();

  const save = async () => {
    if (draft === undefined) return;
    const trimmed = draft.trim();
    setDraft(undefined);
    if (trimmed === stored.trim()) return;
    await db.profile.put({ id: 'me', businessDescription: trimmed });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Laptop aria-hidden className="size-5 text-emerald-700" />
        <h3 className="font-semibold">Your business</h3>
      </div>
      <label htmlFor="profile" className="mt-2 block text-sm text-slate-700">
        What does your business pay for? This helps the on-device model.
      </label>
      <textarea
        id="profile"
        rows={4}
        value={value}
        onChange={(e) => {
          setSaved(false);
          setDraft(e.target.value);
        }}
        onBlur={() => void save()}
        placeholder="Freelance graphic designer. Business tools: design software, stock photos, coworking desk, portfolio website."
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-ink-800"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <Lock aria-hidden className="size-3.5" /> Stays on this device. Never sent to the cloud.
        </p>
        <Button
          variant="ghost"
          className="min-h-8 shrink-0 px-3"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void save()}
          disabled={!dirty}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
