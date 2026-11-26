// Advisor screen with the outgoing-message guard in front of it. Each function call the
// cloud model makes is shown with the exact totals this device sent back.

import { ArrowUp, Ban, Cloud, Cpu, LoaderCircle, MessageSquarePlus, ShieldCheck, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Badge, Button, Card } from '../components/ui';
import { advisorStore, resetAdvisor, sendToAdvisor, type ChatItem } from '../lib/advisorStore';
import { cloudRetryStore } from '../lib/cloudCall';
import { useOnline } from '../lib/device';
import { cloudReady } from '../lib/firebase';
import { CLOUD_MODEL } from '../lib/models';
import { useStore } from '../lib/store';

const SUGGESTIONS = [
  'How much did I spend on business software this month?',
  'What is my biggest business cost?',
  'Compare my business and personal spending.',
  'How many transactions still need review?',
];

export function AdvisorView() {
  const { items, busy } = useStore(advisorStore);
  const online = useOnline();
  const { retrying } = useStore(cloudRetryStore);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const disabled = !online || !cloudReady;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [items.length, busy]);

  const submit = (text: string) => {
    if (disabled || busy || !text.trim()) return;
    setDraft('');
    void sendToAdvisor(text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Advisor</h1>
          <p className="mt-0.5 max-w-2xl text-sm text-slate-600">
            The cloud model never sees a transaction. It asks this device for totals, and you can see each answer this device gave.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="ghost" onClick={resetAdvisor} disabled={busy !== false}>
            <MessageSquarePlus aria-hidden className="size-4" /> New chat
          </Button>
        )}
      </div>

      <Card className="flex min-h-[30rem] flex-col p-0">
        <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {items.length === 0 && <EmptyChat onPick={submit} disabled={disabled} />}
          {items.map((item) => (
            <Message key={item.id} item={item} />
          ))}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
              {busy === 'checking' ? 'Checking your message on this device…' : retrying ? 'The cloud model is busy. Trying again…' : 'Asking the cloud model…'}
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-slate-100 p-3 sm:p-4">
          {disabled && (
            <p className="mb-2 flex items-center gap-2 text-sm text-amber-900">
              <WifiOff aria-hidden className="size-4" />
              {!cloudReady ? 'Cloud features are not configured in this build.' : 'The advisor needs a connection. Labeling and review still work offline.'}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-ink-800">
            <label htmlFor="advisor-input" className="sr-only">
              Ask about your totals
            </label>
            <textarea
              id="advisor-input"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="Ask about your totals, e.g. “What did I spend on travel this month?”"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500 focus-visible:outline-none"
            />
            <Button variant="primary" type="submit" aria-label="Send" className="size-10 shrink-0 px-0" disabled={disabled || busy !== false || !draft.trim()}>
              <ArrowUp aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-slate-600">
            <ShieldCheck aria-hidden className="size-3.5 text-emerald-700" />
            Messages with transaction details or merchant names from your data are blocked on this device before sending.
          </p>
        </form>
      </Card>
    </div>
  );
}

function EmptyChat({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-sky-50 text-sky-700">
        <Cloud aria-hidden className="size-6" />
      </span>
      <h2 className="mt-3 font-semibold">Ask about your totals</h2>
      <p className="mt-1 max-w-md text-sm text-slate-600">Try one of these. Watch the data boundary panel: only totals cross it.</p>
      <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-full bg-white px-3 py-1.5 text-sm text-slate-800 ring-1 ring-slate-300 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ item }: { item: ChatItem }) {
  if (item.kind === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <p
          className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap ${
            item.status === 'blocked' ? 'bg-rose-50 text-rose-900 ring-1 ring-rose-300' : 'bg-ink-800 text-white'
          }`}
        >
          {item.text}
        </p>
        {item.status === 'blocked' && <span className="text-xs font-medium text-rose-700">Not sent</span>}
      </div>
    );
  }

  if (item.kind === 'blocked') {
    return (
      <div role="alert" className="flex gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 ring-1 ring-rose-200">
        <Ban aria-hidden className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-semibold">Blocked on this device. Nothing was sent.</p>
          <p className="mt-0.5">Why: {item.reasons.join('; ')}.</p>
          <p className="mt-1 text-rose-800">Ask about totals or categories instead, for example “How much did I spend on travel this month?”</p>
        </div>
      </div>
    );
  }

  if (item.kind === 'call') {
    return (
      <details className="group rounded-xl bg-emerald-50/70 px-4 py-2.5 text-sm ring-1 ring-emerald-200">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-emerald-900">
          <Cpu aria-hidden className="size-4 shrink-0" />
          <span>
            Cloud asked this device: <span className="font-semibold">{item.label}</span>
          </span>
          <span className="ml-auto text-xs font-medium text-emerald-800 group-open:hidden">Show what was sent</span>
          <span className="ml-auto hidden text-xs font-medium text-emerald-800 group-open:inline">Hide</span>
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-white p-3 font-mono text-xs leading-relaxed text-slate-800 ring-1 ring-emerald-200">
          {JSON.stringify(item.result, null, 2)}
        </pre>
      </details>
    );
  }

  if (item.kind === 'assistant') {
    return (
      <div className="flex flex-col items-start gap-1">
        <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm whitespace-pre-wrap text-slate-900 shadow-sm ring-1 ring-slate-200">
          {item.text}
        </p>
        <Badge tone="cloud">
          <Cloud aria-hidden className="size-3" /> Cloud · {CLOUD_MODEL}
        </Badge>
      </div>
    );
  }

  return (
    <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      {item.text}
    </p>
  );
}
