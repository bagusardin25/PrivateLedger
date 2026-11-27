// Advisor screen with the outgoing-message guard in front of it. Each function call the
// cloud model makes is shown with the exact totals this device sent back.

import {
  ArrowRight,
  ArrowUp,
  Ban,
  ChevronDown,
  Cloud,
  Cpu,
  LoaderCircle,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Badge, Button, Card, CopyButton } from '../components/ui';
import { advisorStore, resetAdvisor, sendToAdvisor, type ChatItem } from '../lib/ai/advisorStore';
import { cloudRetryStore } from '../lib/ai/cloudCall';
import { useOnline } from '../lib/state/device';
import { cloudReady } from '../lib/ai/firebase';
import { CLOUD_MODEL } from '../lib/ai/models';
import { useStore } from '../lib/util/store';

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Advisor</h1>
            <Badge tone="device">
              <ShieldCheck aria-hidden className="size-3" /> On-device guard
            </Badge>
            <Badge tone="cloud">
              <Cloud aria-hidden className="size-3" /> Cloud totals-only
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            The cloud model never sees a transaction. It calls local functions on this device for totals, and every response is visible below.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="secondary" className="min-h-9 rounded-xl px-3 text-xs" onClick={resetAdvisor} disabled={busy !== false}>
            <MessageSquarePlus aria-hidden className="size-3.5" /> New chat
          </Button>
        )}
      </div>

      <Card className="flex min-h-[26rem] flex-col overflow-hidden p-0 lg:min-h-[28.5rem]">
        <div role="log" aria-live="polite" aria-label="Conversation" className="thin-scroll flex-1 space-y-4 overflow-y-auto bg-slate-50/35 px-5 py-5 sm:px-6">
          {items.length === 0 && <EmptyChat onPick={submit} disabled={disabled} />}
          {items.map((item) => (
            <Message key={item.id} item={item} />
          ))}
          {busy && (
            <div className="inline-flex items-center gap-2.5 rounded-full bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-2xs ring-1 ring-slate-200/80">
              <LoaderCircle aria-hidden className={`size-3.5 animate-spin motion-reduce:animate-none ${busy === 'checking' ? 'text-emerald-600' : 'text-sky-600'}`} />
              {busy === 'checking'
                ? 'Checking your message with the on-device guard…'
                : retrying
                  ? 'The cloud model is busy. Trying again…'
                  : 'Asking the cloud model…'}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-slate-200/80 bg-white p-3.5 sm:p-4">
          {disabled && (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-950 ring-1 ring-amber-200/90">
              <WifiOff aria-hidden className="size-4 shrink-0 text-amber-700" />
              {!cloudReady ? 'Cloud features are not configured in this build.' : 'The advisor needs a connection. Labeling and review still work offline.'}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl bg-slate-50/90 p-2 shadow-inner ring-1 ring-slate-200/90 transition-all focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(23,50,86,0.1)] focus-within:ring-ink-700">
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
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
            />
            <Button
              variant="primary"
              type="submit"
              aria-label="Send"
              className="size-10 shrink-0 rounded-xl px-0"
              disabled={disabled || busy !== false || !draft.trim()}
            >
              <ArrowUp aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 px-1 text-xs text-slate-500">
            <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-emerald-700" />
            Messages with transaction details or merchant names from your data are blocked on this device before sending.
          </p>
        </form>
      </Card>
    </div>
  );
}

function EmptyChat({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center px-2 py-4 text-center">
      <div className="flex items-center gap-2">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80">
          <Cpu aria-hidden className="size-5" />
        </span>
        <span aria-hidden className="text-xs font-bold text-slate-300">
          ↔
        </span>
        <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-200/80">
          <Sparkles aria-hidden className="size-5" />
        </span>
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">Ask about your totals</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Try a question below and watch the Data Boundary panel — only aggregated numbers ever cross to the cloud.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-left text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/90 transition-all duration-150 hover:-translate-y-0.5 hover:text-ink-900 hover:shadow-sm hover:ring-ink-200 disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="leading-snug">{s}</span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-700" />
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
          className={`max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            item.status === 'blocked'
              ? 'bg-rose-50 text-rose-950 ring-1 ring-rose-300'
              : 'bg-gradient-to-b from-ink-700 to-ink-800 text-white shadow-xs'
          }`}
        >
          {item.text}
        </p>
        {item.status === 'blocked' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
            <Ban aria-hidden className="size-3" /> Not sent
          </span>
        )}
      </div>
    );
  }

  if (item.kind === 'blocked') {
    return (
      <div role="alert" className="flex gap-3 rounded-2xl bg-rose-50/95 p-4 text-sm text-rose-950 shadow-xs ring-1 ring-rose-300/80">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 ring-1 ring-rose-300/70">
          <Ban aria-hidden className="size-4" />
        </span>
        <div>
          <p className="font-semibold text-rose-950">Blocked on this device. Nothing was sent.</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-900">Why: {item.reasons.join('; ')}.</p>
          <p className="mt-1.5 text-xs text-rose-800">
            Ask about totals or categories instead, for example &ldquo;How much did I spend on travel this month?&rdquo;
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === 'call') {
    const json = JSON.stringify(item.result, null, 2);
    return (
      <details className="group overflow-hidden rounded-2xl bg-emerald-50/75 text-sm ring-1 ring-emerald-200/90">
        <summary className="flex list-none items-center gap-2.5 px-4 py-2.5 text-emerald-950 transition-colors hover:bg-emerald-50">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 ring-1 ring-emerald-200/80">
            <Cpu aria-hidden className="size-3.5" />
          </span>
          <span className="text-xs sm:text-sm">
            Cloud asked this device: <span className="font-semibold">{item.label}</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
            <span className="group-open:hidden">Inspect totals</span>
            <span className="hidden group-open:inline">Hide</span>
            <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <div className="border-t border-emerald-200/70 bg-slate-950">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-3.5 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            <span>Totals returned by local function</span>
            <CopyButton text={json} label="Copy" dark />
          </div>
          <pre className="code-inspector max-h-56 overflow-auto p-3.5 font-mono text-xs leading-relaxed">{json}</pre>
        </div>
      </details>
    );
  }

  if (item.kind === 'assistant') {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/90">
          {item.text}
        </p>
        <Badge tone="cloud">
          <Cloud aria-hidden className="size-3" /> Cloud · {CLOUD_MODEL}
        </Badge>
      </div>
    );
  }

  return (
    <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
      {item.text}
    </p>
  );
}
