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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="w-full rounded-xl border border-zinc-200/80 bg-white p-7 dark:border-white/[0.08] dark:bg-[#111114]">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
            <ShieldAlert aria-hidden className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Your transactions and the Privacy Ledger are still safely stored in this browser. Reloading brings the app back, and nothing was sent anywhere.
          </p>
          <pre className="code-inspector mt-5 max-h-36 w-full overflow-auto rounded-lg border border-zinc-800 p-3 text-left font-mono text-xs leading-relaxed">
            {this.state.error.message}
          </pre>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              Reload the app
            </button>
            <a
              href="#/welcome"
              onClick={() => this.setState({ error: undefined })}
              className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-white/[0.1] dark:bg-[#16161a] dark:text-zinc-100 dark:hover:bg-white/[0.06]"
            >
              Go to Home
            </a>
          </div>
        </div>
      </main>
    );
  }
}
