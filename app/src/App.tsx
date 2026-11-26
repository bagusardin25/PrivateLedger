import { useLiveQuery } from 'dexie-react-hooks';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { DataBoundaryPanel } from './components/DataBoundaryPanel';
import { JourneySteps } from './components/JourneySteps';
import { ModelStatusChip } from './components/ModelStatus';
import { BrandMark } from './components/ui';
import { type Route } from './lib/actions';
import { db } from './lib/db';
import { refreshDeviceStatus, useOnline } from './lib/device';
import { ImportView } from './views/ImportView';
import { ReviewView } from './views/ReviewView';
import { SummaryView } from './views/SummaryView';
import { TransactionsView } from './views/TransactionsView';
import { WelcomeView } from './views/WelcomeView';

const ALL_ROUTES: Route[] = ['welcome', 'import', 'transactions', 'review', 'summary'];

const NAV: { id: Route; label: string }[] = [
  { id: 'welcome', label: 'Home' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'review', label: 'Review' },
  { id: 'summary', label: 'Summary' },
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
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <a href="#/welcome" className="flex items-center gap-2.5 rounded-md">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight">Private Ledger</span>
          </a>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((r) => (
              <a
                key={r.id}
                href={`#/${r.id}`}
                aria-current={route === r.id ? 'page' : undefined}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                  route === r.id ? 'bg-slate-900/5 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {r.label}
                {r.id === 'review' && reviewCount > 0 && (
                  <span aria-label={`${reviewCount} to review`} className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 tabular-nums">
                    {reviewCount}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ModelStatusChip />
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${online ? 'text-slate-600' : 'text-amber-900'}`}>
              {online ? <Wifi aria-hidden className="size-4" /> : <WifiOff aria-hidden className="size-4" />}
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {isHome ? (
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <WelcomeView />
        </main>
      ) : (
        <div className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
          <JourneySteps route={route} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]">
            <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
              {route === 'import' && <ImportView />}
              {route === 'transactions' && <TransactionsView />}
              {route === 'review' && <ReviewView />}
              {route === 'summary' && <SummaryView />}
            </main>
            <div className="lg:sticky lg:top-20 lg:self-start">
              <DataBoundaryPanel />
            </div>
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-[1400px] px-4 pt-2 pb-8 text-xs text-slate-600 sm:px-6">
        Labels are suggestions you confirm. Not financial or tax advice.
      </footer>
    </div>
  );
}
