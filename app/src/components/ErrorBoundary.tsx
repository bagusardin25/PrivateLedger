// If a screen throws while rendering, show a way back instead of a blank page.
// Transactions and the ledger live in IndexedDB, so a reload loses nothing.

import { ShieldAlert } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Stays in this browser's console; nothing is reported anywhere.
    console.error('Private Ledger failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="w-full rounded-2xl border border-stone-200/85 bg-white p-8 shadow-[0_8px_30px_-8px_rgba(24,24,27,0.12)] dark:border-white/[0.08] dark:bg-[#12131c]">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:ring-amber-800">
            <ShieldAlert aria-hidden className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">Something went wrong on this screen</h1>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Your transactions and the Privacy Ledger are still safely stored in this browser. Reloading brings the app back, and nothing was sent anywhere.
          </p>
          <pre className="code-inspector mt-5 max-h-36 w-full overflow-auto rounded-xl p-3.5 text-left font-mono text-xs leading-relaxed">
            {this.state.error.message}
          </pre>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-10 items-center rounded-xl bg-gradient-to-b from-ink-700 to-ink-800 px-4 text-sm font-semibold text-white shadow-sm transition hover:from-ink-600 hover:to-ink-700"
            >
              Reload the app
            </button>
            <a
              href="#/welcome"
              onClick={() => this.setState({ error: undefined })}
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 shadow-xs ring-1 ring-stone-200 ring-inset transition hover:bg-stone-50 dark:bg-white/[0.06] dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-white/[0.1]"
            >
              Go to Home
            </a>
          </div>
        </div>
      </main>
    );
  }
}
