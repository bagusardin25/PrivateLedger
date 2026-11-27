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
  { icon: WifiOff, text: 'Sorting works offline' },
  { icon: ScrollText, text: 'Every cloud request logged' },
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
      <section className="border-b border-line bg-white dark:bg-canvas">
        <div className="mx-auto grid max-w-[1240px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-16 lg:py-20">
          <div className="fade-up min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-sunken px-3 py-1 text-xs font-medium text-fg-secondary">
              <span aria-hidden className="size-1.5 rounded-full bg-device" />
              For freelancers · Powered by Gemini Nano in Chrome
            </p>

            <h1 className="mt-6 text-3xl leading-[1.08] font-semibold tracking-[-0.035em] text-fg text-balance sm:text-[2.85rem]">
              Sort business from personal spending.{' '}
              <span className="text-fg-muted">Your bank statement never leaves your laptop.</span>
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-fg-secondary sm:text-base">
              AI built into Chrome sorts each transaction right on your laptop. The cloud only ever sees totals, and the Privacy panel shows you
              exactly what was sent.
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
                    <FileUp aria-hidden className="size-3.5 text-fg-muted" /> Import your CSV
                  </Button>
                </>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-danger-line bg-danger-soft px-3.5 py-2 text-xs text-danger-ink"
              >
                Couldn't load the demo: {error}
              </p>
            )}

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5 border-t border-line-soft pt-6 text-xs text-fg-muted">
              {PROMISES.map((p) => (
                <li key={p.text} className="inline-flex items-center gap-1.5">
                  <p.icon aria-hidden className="size-3.5 text-fg-faint" />
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
            <p className="text-xs font-medium text-fg-muted">Before you start</p>
            <h2 id="setup" className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
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
  { merchant: 'Adobe Creative Cloud', category: 'Software & Subscriptions', amount: '−$59.99', type: 'business' as const, by: 'Laptop AI' },
  { merchant: 'Whole Foods Market', category: 'Groceries', amount: '−$86.42', type: 'personal' as const, by: 'Laptop AI' },
  { merchant: 'Stripe · Acme Studio', category: 'Income', amount: '+$2,400.00', type: 'business' as const, by: 'Saved rule' },
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
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_36px_-16px_rgba(0,0,0,0.08)] dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.75)]">
        {/* Clean architectural window bar + mode tabs */}
        <div className="border-b border-line-soft bg-sunken px-4 pt-3 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-fg-muted">
              <Lock aria-hidden className="size-3 text-device-fg" />
              private-ledger · local
            </span>
            <span className="text-[11px] font-medium text-fg-muted">Interactive preview</span>
          </div>

          <div
            role="tablist"
            aria-label="Feature preview"
            className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-emphasis p-0.5"
          >
            {(
              [
                ['local', 'Laptop AI', Cpu],
                ['cloud', 'Totals only', Cloud],
                ['guard', 'Privacy check', Ban],
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
                  className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white text-fg shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:bg-[#1b1b20]'
                      : 'text-fg-secondary hover:text-fg'
                  }`}
                >
                  <Icon
                    aria-hidden
                    className={`size-3.5 shrink-0 max-sm:hidden ${
                      active
                        ? id === 'local'
                          ? 'text-device-fg'
                          : id === 'cloud'
                            ? 'text-cloud-fg'
                            : 'text-danger-fg'
                        : 'text-fg-faint'
                    }`}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Tab Body */}
        <div className="min-h-[16.75rem] bg-surface">
          {tab === 'local' && (
            <ul className="divide-y divide-line-soft">
              {DEMO_PREVIEW_ROWS.map((row) => (
                <li key={row.merchant} className="flex items-center gap-3 px-4 py-3">
                  <MerchantAvatar name={row.merchant} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{row.merchant}</p>
                    <p className="truncate text-xs text-fg-muted">
                      {row.category} · {row.by}
                    </p>
                  </div>
                  <span
                    className={`text-[13px] font-medium tabular-nums ${
                      row.amount.startsWith('+') ? 'text-device-fg' : 'text-fg'
                    }`}
                  >
                    {row.amount}
                  </span>
                  <span
                    className={`w-[4.5rem] rounded-md py-1 text-center text-[11px] font-medium ${
                      row.type === 'business'
                        ? 'bg-inverse text-on-inverse'
                        : 'bg-subtle text-fg-secondary'
                    }`}
                  >
                    {row.type === 'business' ? 'Business' : 'Personal'}
                  </span>
                </li>
              ))}
              <li
                className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors ${
                  coffeeChoice === 'unsure' ? 'bg-review-soft/50' : ''
                }`}
              >
                <MerchantAvatar name="Starbucks" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">Starbucks</p>
                  <p className="truncate text-xs text-fg-muted">
                    {coffeeChoice === 'unsure' ? 'Could be either · you decide' : 'Remembered for next time'}
                  </p>
                </div>
                <span className="text-[13px] font-medium text-fg tabular-nums">−$6.45</span>
                <div className="inline-flex gap-0.5 rounded-md border border-line bg-sunken p-0.5">
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('business')}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      coffeeChoice === 'business'
                        ? 'bg-inverse text-on-inverse'
                        : 'text-fg-secondary hover:text-fg'
                    }`}
                  >
                    Business
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoffeeChoice('personal')}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                      coffeeChoice === 'personal'
                        ? 'bg-zinc-700 text-white dark:bg-zinc-500'
                        : 'text-fg-secondary hover:text-fg'
                    }`}
                  >
                    Personal
                  </button>
                </div>
              </li>
            </ul>
          )}

          {tab === 'cloud' && (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-fg-secondary">What the cloud gets for a monthly summary</p>
                <Badge tone="cloud">Cloud AI</Badge>
              </div>
              <PayloadViewer
                title="Example request (same format as the real one)"
                content={CLOUD_TOTALS_SAMPLE}
                accent="cloud"
                maxHeightClass="max-h-44"
                showCopy={false}
              />
              <p className="text-xs text-fg-muted">
                No bank descriptions, dates, client names, or single transactions. After a real run, the Privacy Ledger shows the exact
                request.
              </p>
            </div>
          )}

          {tab === 'guard' && (
            <div className="space-y-3 p-4">
              <div className="flex flex-col items-end gap-1">
                <p className="max-w-[92%] rounded-xl rounded-br-sm border border-danger-line bg-danger-soft px-3 py-2 font-mono text-xs text-danger-ink">
                  10/12 DELTA AIR LINES -312.40 — is this deductible?
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger-fg">
                  <Ban aria-hidden className="size-3" /> Not sent · nothing left your laptop
                </span>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border border-danger-line bg-danger-soft p-3 text-xs leading-relaxed text-danger-ink">
                <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" />
                <div>
                  <p className="font-semibold">Stopped on your laptop before sending.</p>
                  <p className="mt-0.5 opacity-90">It had an amount, a date, and a merchant from your statement. Ask about category totals instead.</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-line bg-sunken px-3 py-2 text-[11px] text-fg-secondary">
                <span>Checked on your laptop by saved rules and Laptop AI</span>
                <Badge tone="device">On your laptop</Badge>
              </div>
            </div>
          )}
        </div>

        {/* Clean hairline split boundary footer */}
        <div className="relative grid grid-cols-2 divide-x divide-line border-t border-line bg-sunken">
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Laptop aria-hidden className="size-4 shrink-0 text-device-fg" />
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-fg tabular-nums">40</span>
              <span className="text-[11px] text-fg-muted">kept on your laptop</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-3">
            <Cloud aria-hidden className="size-4 shrink-0 text-cloud-fg" />
            <div className="leading-tight">
              <span className="block text-sm font-semibold text-device-fg tabular-nums">0</span>
              <span className="text-[11px] text-fg-muted">transactions sent</span>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs text-fg-muted">
        <ShieldCheck aria-hidden className="size-3.5 text-device-fg" />
        Switch tabs to see what stays on your laptop and what the cloud gets
      </figcaption>
    </figure>
  );
}

const PIPELINE_STEPS = [
  { icon: FileUp, label: 'Bank CSV' },
  { icon: ListChecks, label: 'Saved rules' },
  { icon: Cpu, label: 'Laptop AI' },
  { icon: Database, label: 'Browser storage' },
];

// The function name, arguments, and answer use the real format from lib/ai/localFunctions.ts; the figures are examples.
const LOCAL_TOOL_SNIPPET = `// Cloud AI asks your laptop for a total
get_spending_by_category({ "period": "2026-10", "type": "business" })

// Your laptop looks it up and answers with totals only
{ "period": "2026-10", "type": "business", "currency": "USD", "totals": [
  { "category": "Office & Coworking", "total": 350, "count": 1 },
  { "category": "Travel", "total": 312.4, "count": 1 } ] }`;

/** Unified architectural hairline grid explaining the hybrid data boundary. */
function ArchitectureSection() {
  return (
    <section aria-labelledby="how-it-works">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-fg-muted">How it works</p>
          <h2 id="how-it-works" className="mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            What stays on your laptop, and what doesn&apos;t
          </h2>
        </div>
        <p className="text-sm text-fg-muted">The more private the data, the closer it stays to you.</p>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
        {/* Card 1: Local pipeline (7 cols) */}
        <article className="min-w-0 rounded-xl border border-line bg-surface p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="device">
              <Laptop aria-hidden className="size-3" /> Stays on your laptop
            </Badge>
            <code className="font-mono text-[11px] font-medium text-fg-muted">ONLY_ON_DEVICE</code>
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-fg">
            Your transactions are sorted inside Chrome
          </h3>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-secondary">
            Saved rules handle transfers, fees, and stores you use for both right away. Gemini Nano, the AI built into Chrome, sorts the rest.
            Nothing leaves your browser&apos;s storage.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={step.label}
                className="flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-xs font-medium text-fg-secondary"
              >
                <step.icon aria-hidden className="size-3.5 shrink-0 text-device-fg" />
                <span className="truncate">
                  <span className="mr-1 text-fg-muted">{i + 1}.</span>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Card 2: Auditable proof (5 cols) */}
        <article className="flex flex-col justify-between rounded-xl border border-line bg-surface p-6 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Badge tone="neutral">
                <ShieldCheck aria-hidden className="size-3 text-device-fg" /> Proof you can check
              </Badge>
              <span className="text-[11px] text-fg-muted">Not a promise</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-fg">A record you can check</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
              Every AI request is written to the Privacy Ledger: what was sent, where it ran, and how big it was. You can export it.
            </p>
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-line-soft pt-4">
            <span className="text-3xl leading-none font-semibold text-device-fg tabular-nums">0</span>
            <div className="text-xs leading-snug text-fg-muted">
              <strong className="block font-semibold text-fg">Transactions sent</strong>
              Counted from the Privacy Ledger. The online version also blocks the page from contacting any server it doesn&apos;t need.
            </div>
          </div>
        </article>

        {/* Card 3: Local function calling bridge (12 cols) */}
        <article className="min-w-0 rounded-xl border border-line bg-surface p-6 lg:col-span-12">
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="cloud">
                  <Cloud aria-hidden className="size-3" /> Cloud thinks · your laptop keeps the data
                </Badge>
                <code className="font-mono text-[11px] text-fg-muted">ONLY_IN_CLOUD + Local Functions</code>
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight text-fg sm:text-xl">
                Ask the Advisor about your totals
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                Cloud AI can&apos;t read your bank statement. When it needs a number, it asks your laptop, and your laptop answers with totals only. If
                you paste a statement line by mistake, a privacy check on your laptop stops it before it&apos;s sent.
              </p>
            </div>
            <PayloadViewer
              title="How Cloud AI asks your laptop for totals"
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
        <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-sunken text-fg-secondary">
          <Laptop aria-hidden className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-fg">Your business</h3>
          <p className="text-xs text-fg-muted">Helps Laptop AI sort your spending</p>
        </div>
      </div>

      <label htmlFor="profile" className="mt-4 block text-xs font-medium text-fg-secondary">
        What does your business pay for? Pick an example or describe your work:
      </label>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {PROFILE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => void persist(preset.text)}
            className="rounded-md border border-line bg-sunken px-2.5 py-1 text-xs font-medium text-fg-secondary transition-colors hover:border-line-strong hover:bg-subtle hover:text-fg"
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
        className="mt-3 w-full rounded-lg border border-line bg-sunken p-3 text-sm leading-relaxed text-fg transition-colors placeholder:text-fg-faint focus:border-focus focus:bg-surface focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Lock aria-hidden className="size-3 text-device-fg" /> Stays on your laptop. Never sent to the cloud.
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
