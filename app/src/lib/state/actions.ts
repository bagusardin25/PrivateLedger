import { db } from '../data/db';
import { loadDemoData } from '../data/importer';
import { resetAdvisor } from '../ai/advisorStore';
import { resetExplanations } from '../ai/explainer';
import { labelingStore, recentArrivals, runOnDeviceLabeling } from '../ai/labelingRunner';
import { resetSummary } from '../ai/reporter';
import type { Category, TxType } from '../core/taxonomy';

/** Forgets in-memory results about the old transactions: chat, summary, explanations, sorting progress. */
export function resetSessionState(): void {
  resetAdvisor();
  resetSummary();
  resetExplanations();
  recentArrivals.clear();
  labelingStore.set({ status: 'idle', done: 0, total: 0, batch: 0, batches: 0, firstItemMs: undefined, message: undefined });
}

export type Route = 'welcome' | 'import' | 'transactions' | 'review' | 'summary' | 'advisor' | 'ledger';

// Screens have clean URLs (/transactions, /review). Firebase Hosting rewrites every
// path to index.html, and the service worker serves the cached shell offline.
const ROUTES: readonly Route[] = ['welcome', 'import', 'transactions', 'review', 'summary', 'advisor', 'ledger'];
const ROUTE_EVENT = 'private-ledger:route';

/** "/" for Home, "/transactions" and so on for the other screens. */
export function routePath(route: Route): string {
  return route === 'welcome' ? '/' : `/${route}`;
}

/** Any path the app does not know opens Home. */
export function routeFromPath(pathname: string): Route {
  const id = pathname.replace(/^\/+|\/+$/g, '') as Route;
  return ROUTES.includes(id) ? id : 'welcome';
}

export function currentRoute(): Route {
  return routeFromPath(window.location.pathname);
}

export function subscribeRoute(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener(ROUTE_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(ROUTE_EVENT, listener);
  };
}

export function navigate(route: Route): void {
  const path = routePath(route);
  if (window.location.pathname !== path || window.location.hash) window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

/**
 * On load, shows the screen's clean URL in the address bar: links from before
 * clean URLs ("/#/transactions") open that screen, and an unknown path becomes "/".
 */
export function normalizeUrl(): void {
  const old = /^#\/([a-z]+)$/.exec(window.location.hash);
  const route = old ? routeFromPath(old[1]) : currentRoute();
  if (old || window.location.pathname !== routePath(route)) window.history.replaceState(null, '', routePath(route));
}

/**
 * In-app links are plain <a href="/review"> elements, so they work with a middle
 * click or "Open in new tab". A normal click becomes a history update instead of
 * a page load. Listens on the document; anything that is not an app route is left alone.
 */
export function handleLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = event.target instanceof Element ? event.target.closest('a') : null;
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const href = anchor.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  const { origin, pathname } = new URL(anchor.href);
  if (origin !== window.location.origin || routePath(routeFromPath(pathname)) !== pathname) return;
  event.preventDefault();
  navigate(routeFromPath(pathname));
}

let setupRequested = false;

function scrollToSetup(): void {
  document.getElementById('setup')?.scrollIntoView({ block: 'start' });
}

/** Opens the Home screen at "Set up in a minute", where on-device AI is turned on. */
export function openSetup(): void {
  if (currentRoute() === 'welcome') {
    scrollToSetup();
    return;
  }
  setupRequested = true;
  navigate('welcome');
}

/** Called by the app shell after a route change; true when it scrolled to the setup section. */
export function consumeSetupRequest(): boolean {
  if (!setupRequested) return false;
  setupRequested = false;
  scrollToSetup();
  return true;
}

/** "Try with demo data": load the synthetic statement, open the table, start labeling. */
export async function startDemo(): Promise<void> {
  await loadDemoData();
  navigate('transactions');
  void runOnDeviceLabeling();
}

/**
 * One click sets business or personal, clears the review flag, and saves
 * the choice as merchant memory so the same merchant never needs the model again.
 */
export async function setTypeByUser(transactionId: string, type: Exclude<TxType, 'unsure'>): Promise<void> {
  const tx = await db.transactions.get(transactionId);
  if (!tx) return;
  const category = tx.category ?? 'Other';
  await db.transaction('rw', db.transactions, db.merchantRules, async () => {
    await db.merchantRules.put({ merchantKey: tx.merchantKey, type, category, updatedAt: Date.now() });
    const sameMerchant = await db.transactions.where('merchantKey').equals(tx.merchantKey).toArray();
    await db.transactions.bulkUpdate(
      sameMerchant
        .filter((t) => t.id === tx.id || t.source !== 'you')
        .map((t) => ({
          key: t.id,
          changes: {
            type,
            category: t.category ?? category,
            source: t.id === tx.id ? ('you' as const) : ('memory' as const),
            needsReview: false,
            reviewReason: undefined,
            reviewed: t.id === tx.id ? true : t.reviewed,
          },
        })),
    );
  });
}

/**
 * "Label by hand": rows the on-device model could not reach go to the
 * review queue, so the user decides them one card at a time. Nothing is sent.
 */
export async function labelPendingByHand(): Promise<void> {
  const pending = await db.transactions.filter((t) => t.source === 'pending').toArray();
  await db.transactions.bulkUpdate(
    pending.map((t) => ({
      key: t.id,
      changes: {
        type: 'unsure' as const,
        category: t.category ?? 'Other',
        source: 'you' as const,
        needsReview: true,
        reviewReason: "Laptop AI wasn't available, so you decide",
      },
    })),
  );
  navigate('review');
}

/** Allows correcting a row's category and updating merchant memory when type is settled. */
export async function setCategoryByUser(transactionId: string, category: Category): Promise<void> {
  const tx = await db.transactions.get(transactionId);
  if (!tx) return;
  if (tx.type !== 'business' && tx.type !== 'personal') {
    await db.transactions.update(tx.id, { category });
    return;
  }
  const settledType = tx.type;
  await db.transaction('rw', db.transactions, db.merchantRules, async () => {
    await db.merchantRules.put({ merchantKey: tx.merchantKey, type: settledType, category, updatedAt: Date.now() });
    const sameMerchant = await db.transactions.where('merchantKey').equals(tx.merchantKey).toArray();
    await db.transactions.bulkUpdate(
      sameMerchant
        .filter((t) => t.id === tx.id || t.source !== 'you')
        .map((t) => ({
          key: t.id,
          changes: {
            type: t.type === 'business' || t.type === 'personal' ? t.type : settledType,
            category,
            source: t.id === tx.id ? ('you' as const) : ('memory' as const),
            reviewed: t.id === tx.id ? true : t.reviewed,
          },
        })),
    );
  });
}
