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
import { consumeSetupRequest, currentRoute, handleLinkClick, routePath, subscribeRoute, type Route } from './lib/state/actions';
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
      title="Install Private Ledger as an app. It opens in its own window and works offline."
      aria-label="Install Private Ledger"
      className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-line bg-raised px-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-subtle hover:text-fg sm:px-2.5"
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

const NAV: { id: Route; label: string; icon: LucideIcon }[] = [
  { id: 'welcome', label: 'Home', icon: House },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'summary', label: 'Summary', icon: PieChart },
  { id: 'advisor', label: 'Advisor', icon: MessageSquare },
  { id: 'ledger', label: 'Privacy Ledger', icon: ShieldCheck },
];

function useRoute(): Route {
  return useSyncExternalStore(subscribeRoute, currentRoute, () => 'welcome' as const);
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
    document.addEventListener('click', handleLinkClick);
    const cancelPrefetch = prefetchScreens();
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('click', handleLinkClick);
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:border focus:border-line focus:bg-surface focus:px-3.5 focus:py-2 focus:text-sm focus:font-medium focus:text-fg focus:shadow-sm"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 xl:min-h-14 xl:flex-nowrap xl:py-0">
          <a href="/" className="group flex shrink-0 items-center gap-2.5 rounded-lg pr-1">
            <BrandMark />
            <span className="text-sm font-semibold tracking-tight whitespace-nowrap text-fg">Private Ledger</span>
          </a>

          <span aria-hidden className="hidden h-4 w-px bg-line xl:block" />

          <nav
            aria-label="Main"
            className="no-scrollbar order-last -mx-1 flex w-full items-center gap-0.5 overflow-x-auto pb-0.5 xl:order-none xl:mx-0 xl:w-auto xl:overflow-visible xl:pb-0"
          >
            {NAV.map((r) => {
              const active = route === r.id;
              return (
                <a
                  key={r.id}
                  href={routePath(r.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 ${
                    active
                      ? 'bg-emphasis text-fg'
                      : 'text-fg-muted hover:bg-subtle hover:text-fg'
                  }`}
                >
                  <r.icon aria-hidden className={`size-3.5 ${active ? 'text-fg' : 'text-fg-faint'}`} />
                  {r.label}
                  {r.id === 'review' && reviewCount > 0 && (
                    <span
                      aria-label={`${reviewCount} to review`}
                      className="rounded-md bg-review-soft px-1.5 py-0.5 text-[10px] leading-none font-semibold text-review-fg tabular-nums"
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
                  ? 'text-fg-muted'
                  : 'border border-review-line bg-review-soft text-review-fg'
              }`}
            >
              {online ? (
                <>
                  <span aria-hidden className="size-1.5 rounded-full bg-device" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff aria-hidden className="size-3.5 text-review-fg" />
                  Offline
                </>
              )}
            </span>
            <span aria-hidden className="h-4 w-px bg-line" />
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

      <footer className="mt-auto border-t border-line">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-fg-muted sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <Lock aria-hidden className="size-3 text-device-fg" />
            Private Ledger · Your statement stays on your laptop · Built with Gemini Nano and Firebase AI Logic
          </span>
          <span>AI suggestions are yours to confirm. Not financial or tax advice.</span>
        </div>
      </footer>
    </div>
  );
}
