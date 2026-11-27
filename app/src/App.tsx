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
      aria-label="Install Private Ledger"
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 sm:px-2.5 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/[0.08]"
    >
      <MonitorDown aria-hidden className="size-3.5" />
      <span className="hidden sm:inline">Install</span>
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
          <div className="skeleton mt-4 h-32 w-full rounded-lg" />
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:border-zinc-200 focus:bg-white focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-950 focus:shadow-sm dark:focus:border-white/10 dark:focus:bg-[#111114] dark:focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#f8f8f7]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#f8f8f7]/75 dark:border-white/[0.07] dark:bg-[#09090b]/85 dark:supports-[backdrop-filter]:bg-[#09090b]/75">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 xl:min-h-14 xl:flex-nowrap xl:py-0">
          <a href="#/welcome" className="group flex shrink-0 items-center gap-2.5 rounded-lg pr-1">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap text-zinc-950 dark:text-white">Private Ledger</span>
          </a>

          <span aria-hidden className="hidden h-4 w-px bg-zinc-200 xl:block dark:bg-white/[0.1]" />

          <nav
            aria-label="Main"
            className="no-scrollbar order-last -mx-1 flex w-full items-center gap-0.5 overflow-x-auto pb-0.5 xl:order-none xl:mx-0 xl:w-auto xl:overflow-visible xl:pb-0"
          >
            {NAV.map((r) => {
              const active = route === r.id;
              return (
                <a
                  key={r.id}
                  href={`#/${r.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
                    active
                      ? 'bg-zinc-200/70 text-zinc-950 dark:bg-white/[0.09] dark:text-white'
                      : 'text-zinc-500 hover:bg-zinc-200/45 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100'
                  }`}
                >
                  <r.icon aria-hidden className={`size-3.5 ${active ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  {r.label}
                  {r.id === 'review' && reviewCount > 0 && (
                    <span
                      aria-label={`${reviewCount} to review`}
                      className="rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-amber-800 tabular-nums dark:bg-amber-500/15 dark:text-amber-300"
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
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium whitespace-nowrap ${
                online
                  ? 'text-zinc-500 dark:text-zinc-400'
                  : 'border border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
              }`}
            >
              {online ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff aria-hidden className="size-3.5 text-amber-700 dark:text-amber-400" />
                  Offline
                </>
              )}
            </span>
            <span aria-hidden className="h-4 w-px bg-zinc-200/90 dark:bg-white/[0.08]" />
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
          <div className="mx-auto max-w-[1380px] space-y-5 px-4 py-5 sm:px-6 sm:py-6">
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
              <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_316px] xl:grid-cols-[minmax(0,1fr)_344px]">
                <main id="main" tabIndex={-1} className="fade-up min-w-0 focus:outline-none">
                  <Screen>
                    {route === 'import' && <ImportView />}
                    {route === 'transactions' && <TransactionsView />}
                    {route === 'review' && <ReviewView />}
                    {route === 'summary' && <SummaryView />}
                    {route === 'advisor' && <AdvisorView />}
                  </Screen>
                </main>
                {/* Sits just under the header, which is two rows tall below xl. */}
                <div className="lg:sticky lg:top-[6.875rem] lg:self-start xl:top-[4.5rem]">
                  <DataBoundaryPanel />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-auto border-t border-zinc-200/75 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Lock aria-hidden className="size-3 text-emerald-700 dark:text-emerald-400" />
            Private Ledger · Local-first in Chrome · Built with Firebase AI Logic
          </span>
          <span>Labels are suggestions you confirm. Not financial or tax advice.</span>
        </div>
      </footer>
    </div>
  );
}
