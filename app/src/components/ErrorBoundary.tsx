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
        <div className="w-full rounded-xl border border-line bg-surface p-7">
          <span className="mx-auto flex size-10 items-center justify-center rounded-lg border border-review-line bg-review-soft text-review-fg">
            <ShieldAlert aria-hidden className="size-5" />
          </span>
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-fg">Something went wrong on this screen</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Your transactions and Privacy Ledger are still saved in this browser, and nothing was sent anywhere. Reload to pick up where you left off.
          </p>
          <pre className="code-inspector mt-5 max-h-36 w-full overflow-auto rounded-lg border border-zinc-800 p-3 text-left font-mono text-xs leading-relaxed">
            {this.state.error.message}
          </pre>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-9 items-center rounded-lg bg-inverse px-3.5 text-[13px] font-medium text-on-inverse transition-colors hover:bg-inverse-hover"
            >
              Reload the app
            </button>
            <a
              href="#/welcome"
              onClick={() => this.setState({ error: undefined })}
              className="inline-flex min-h-9 items-center rounded-lg border border-line bg-raised px-3.5 text-[13px] font-medium text-fg transition-colors hover:bg-subtle"
            >
              Go to Home
            </a>
          </div>
        </div>
      </main>
    );
  }
}
