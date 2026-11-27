import { useLiveQuery } from 'dexie-react-hooks';
import {
  House,
  ListChecks,
  Lock,
  MessageSquare,
  MonitorDown,
  PieChart,
  ReceiptText,
  ShieldCheck,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { DataBoundaryBar } from './components/DataBoundaryBar';
import { DataBoundaryPanel } from './components/DataBoundaryPanel';
import { JourneySteps } from './components/JourneySteps';
import { ModelStatusChip } from './components/ModelStatus';
import { BrandMark, Card, ThemeToggle } from './components/ui';
import { consumeSetupRequest, type Route } from './lib/state/actions';
import { db } from './lib/data/db';
import { refreshDeviceStatus, useOnline } from './lib/state/device';
import { installStore, promptInstall } from './lib/state/install';
import { useStore } from './lib/util/store';
import { WelcomeView } from './views/WelcomeView';

// Home is part of the first download; every other screen is its own chunk.
const loaders = {
  import: () => import('./views/ImportView').then((m) => ({ default: m.ImportView })),
  transactions: () => import('./views/TransactionsView').then((m) => ({ default: m.TransactionsView })),
  review: () => import('./views/ReviewView').then((m) => ({ default: m.ReviewView })),
  summary: () => import('./views/SummaryView').then((m) => ({ default: m.SummaryView })),
  advisor: () => import('./views/AdvisorView').then((m) => ({ default: m.AdvisorView })),
  ledger: () => import('./views/LedgerView').then((m) => ({ default: m.LedgerView })),
};
const ImportView = lazy(loaders.import);
const TransactionsView = lazy(loaders.transactions);
const ReviewView = lazy(loaders.review);
const SummaryView = lazy(loaders.summary);
const AdvisorView = lazy(loaders.advisor);
const LedgerView = lazy(loaders.ledger);

/** Fetches the other screens once the first one is idle, so switching screens never waits on the network. */
function prefetchScreens(): () => void {
  const run = () => Object.values(loaders).forEach((load) => void load());
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }
  const timer = setTimeout(run, 1500);
  return () => clearTimeout(timer);
}

/** Shown only when Chrome says the app can be installed. */
function InstallButton() {
  const { canInstall } = useStore(installStore);
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => void promptInstall()}
      title="Install Private Ledger as an app. It opens in its own window and starts without a connection."
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-ink-50 px-3 text-xs font-semibold text-ink-800 ring-1 ring-ink-200/80 transition-colors hover:bg-ink-100/80 dark:bg-indigo-950/70 dark:text-indigo-200 dark:ring-indigo-700/70 dark:hover:bg-indigo-900/70"
    >
      <MonitorDown aria-hidden className="size-3.5" /> Install
    </button>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Card className="space-y-3 py-10">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-72" />
          <div className="skeleton mt-4 h-32 w-full rounded-xl" />
        </Card>
      }
    >
      {children}
    </Suspense>
  );
}

const ALL_ROUTES: Route[] = ['welcome', 'import', 'transactions', 'review', 'summary', 'advisor', 'ledger'];

const NAV: { id: Route; label: string; icon: LucideIcon }[] = [
  { id: 'welcome', label: 'Home', icon: House },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'summary', label: 'Summary', icon: PieChart },
  { id: 'advisor', label: 'Advisor', icon: MessageSquare },
  { id: 'ledger', label: 'Privacy Ledger', icon: ShieldCheck },
];

function subscribeHash(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '');
  const id = hash.replace(/^#\//, '') as Route;
  return ALL_ROUTES.includes(id) ? id : 'welcome';
}

export function App() {
  const route = useRoute();
  const online = useOnline();
  const reviewCount = useLiveQuery(() => db.transactions.filter((t) => t.needsReview).count(), [], 0);
  const isHome = route === 'welcome';

  useEffect(() => {
    void refreshDeviceStatus();
    const onFocus = () => void refreshDeviceStatus();
    window.addEventListener('focus', onFocus);
    const cancelPrefetch = prefetchScreens();
    return () => {
      window.removeEventListener('focus', onFocus);
      cancelPrefetch();
    };
  }, []);

  useEffect(() => {
    if (route === 'welcome' && consumeSetupRequest()) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-xl focus:bg-white focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-1 focus:ring-stone-200 dark:focus:bg-[#12131c] dark:focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#fdfcfa]/85 backdrop-blur-xl supports-[backdrop-filter]:bg-[#fdfcfa]/78 dark:border-white/[0.08] dark:bg-[#090a0f]/82 dark:supports-[backdrop-filter]:bg-[#090a0f]/75">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6 lg:flex-nowrap xl:gap-x-5">
          <a href="#/welcome" className="group flex shrink-0 items-center gap-2.5 rounded-lg pr-0.5">
            <BrandMark className="transition-transform duration-200 group-hover:scale-[1.04]" />
            <span className="text-[15px] font-bold tracking-tight whitespace-nowrap text-zinc-950 dark:text-white">Private Ledger</span>
          </a>

          <nav
            aria-label="Main"
            className="order-last -mx-1 flex w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-stone-100/95 p-1 ring-1 ring-stone-200/80 lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible dark:bg-white/[0.04] dark:ring-white/[0.08]"
          >
            {NAV.map((r) => {
              const active = route === r.id;
              return (
                <a
                  key={r.id}
                  href={`#/${r.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 xl:px-2.5 xl:text-[13px] ${
                    active
                      ? 'bg-white text-zinc-950 shadow-[0_1px_3px_rgba(24,24,27,0.08)] ring-1 ring-stone-900/5 dark:bg-white/[0.1] dark:text-white dark:ring-white/10'
                      : 'text-zinc-600 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
                  }`}
                >
                  <r.icon aria-hidden className={`size-3.5 ${active ? 'text-ink-700 dark:text-indigo-300' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  {r.label}
                  {r.id === 'review' && reviewCount > 0 && (
                    <span
                      aria-label={`${reviewCount} to review`}
                      className="rounded-full bg-amber-100/95 px-1.5 py-0.5 text-[10px] leading-none font-bold text-amber-900 tabular-nums ring-1 ring-amber-300/80 dark:bg-amber-950/90 dark:text-amber-300 dark:ring-amber-700/70"
                    >
                      {reviewCount}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <InstallButton />
            <ModelStatusChip />
            <span
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset ${
                online
                  ? 'bg-stone-50 text-zinc-600 ring-stone-200/85 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10'
                  : 'bg-amber-50 text-amber-900 ring-amber-300/90 dark:bg-amber-950/80 dark:text-amber-300 dark:ring-amber-700/80'
              }`}
            >
              {online ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-teal-500 dark:bg-teal-400" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff aria-hidden className="size-3.5 text-amber-700 dark:text-amber-400" />
                  Offline
                </>
              )}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex-1">
        {isHome ? (
          <main id="main" tabIndex={-1} className="focus:outline-none">
            <WelcomeView />
          </main>
        ) : (
          <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6">
            <JourneySteps route={route} />
            {route !== 'ledger' && <DataBoundaryBar />}
            {route === 'ledger' ? (
              // The ledger is the full version of the panel, so it gets the whole width.
              <main id="main" tabIndex={-1} className="fade-up min-w-0 focus:outline-none">
                <Screen>
                  <LedgerView />
                </Screen>
              </main>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[minmax(0,1fr)_356px]">
                <main id="main" tabIndex={-1} className="fade-up min-w-0 focus:outline-none">
                  <Screen>
                    {route === 'import' && <ImportView />}
                    {route === 'transactions' && <TransactionsView />}
                    {route === 'review' && <ReviewView />}
                    {route === 'summary' && <SummaryView />}
                    {route === 'advisor' && <AdvisorView />}
                  </Screen>
                </main>
                <div className="lg:sticky lg:top-[4.25rem] lg:self-start">
                  <DataBoundaryPanel />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-auto border-t border-stone-200/80 bg-[#fdfcfa]/70 dark:border-white/[0.07] dark:bg-[#090a0f]/70">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Lock aria-hidden className="size-3.5 text-teal-700 dark:text-teal-400" />
            Private Ledger · Local-first in Chrome · Built with Firebase AI Logic
          </span>
          <span>Labels are suggestions you confirm. Not financial or tax advice.</span>
        </div>
      </footer>
    </div>
  );
}
