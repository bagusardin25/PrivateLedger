// If a screen throws while rendering, show a way back instead of a blank page.
// Transactions and the ledger live in IndexedDB, so a reload loses nothing.

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
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong on this screen</h1>
        <p className="mt-3 text-slate-700">
          Your transactions and the Privacy Ledger are still stored in this browser. Reloading brings the app back, and nothing was sent anywhere.
        </p>
        <pre className="mt-4 max-h-32 w-full overflow-auto rounded-lg bg-white p-3 text-left font-mono text-xs text-slate-700 ring-1 ring-slate-200">
          {this.state.error.message}
        </pre>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex min-h-10 items-center rounded-lg bg-ink-800 px-4 text-sm font-medium text-white hover:bg-ink-700"
          >
            Reload the app
          </button>
          <a href="#/welcome" onClick={() => this.setState({ error: undefined })} className="inline-flex min-h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-900 ring-1 ring-slate-300 ring-inset hover:bg-slate-50">
            Go to Home
          </a>
        </div>
      </main>
    );
  }
}
