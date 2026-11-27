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
  ShieldAlert,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { PayloadViewer } from '../components/PayloadViewer';
import { Button, Card } from '../components/ui';
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

const SAMPLE_LEAK_ROW = '10/12 DELTA AIR LINES 312.40 — can I expense this flight?';

/** Minimal safe inline formatting for cloud answers (bold, inline code, bullet lines). */
function RichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const formatInline = (line: string): ReactNode[] => {
    const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return tokens.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-zinc-950 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="rounded border border-zinc-200/80 bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-900 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-zinc-200"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {lines.map((line, i) => {
        const bullet = /^[-*•]\s+(.*)$/.exec(line.trim());
        if (bullet) {
          return (
            <p key={i} className="flex items-start gap-2 pl-1">
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
              <span>{formatInline(bullet[1])}</span>
            </p>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

export function AdvisorView() {
  const { items, busy } = useStore(advisorStore);
  const online = useOnline();
  const { retrying } = useStore(cloudRetryStore);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const disabled = !online || !cloudReady;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [items.length, busy]);

  const submit = (text: string) => {
    if (disabled || busy || !text.trim()) return;
    setDraft('');
    void sendToAdvisor(text);
  };

  const prefillLeakTest = () => {
    setDraft(SAMPLE_LEAK_ROW);
    inputRef.current?.focus();
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
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl dark:text-white">Advisor</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">
            The cloud model never sees a transaction. It calls local functions on this device for totals, and every response is visible below.
          </p>
        </div>
        {items.length > 0 && (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={resetAdvisor} disabled={busy !== false}>
            <MessageSquarePlus aria-hidden className="size-3.5" /> New chat
          </Button>
        )}
      </div>

      <Card padded={false} className="flex min-h-[27rem] flex-col overflow-hidden lg:min-h-[29rem]">
        {/* Quiet 3-step architectural strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2 text-[11px] font-medium text-zinc-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-zinc-400">
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck aria-hidden className="size-3" /> 1. Guard on device
          </span>
          <ArrowRight aria-hidden className="size-3 text-zinc-300 dark:text-zinc-700" />
          <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400">
            <Cloud aria-hidden className="size-3" /> 2. Cloud reasons
          </span>
          <ArrowRight aria-hidden className="size-3 text-zinc-300 dark:text-zinc-700" />
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <Cpu aria-hidden className="size-3" /> 3. Local functions return totals
          </span>
        </div>

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="thin-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
        >
          {items.length === 0 && <EmptyChat onPick={submit} onTestGuard={prefillLeakTest} disabled={disabled} />}
          {items.map((item) => (
            <Message key={item.id} item={item} />
          ))}
          {busy && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300">
              <LoaderCircle
                aria-hidden
                className={`size-3.5 animate-spin motion-reduce:animate-none ${
                  busy === 'checking' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                }`}
              />
              {busy === 'checking'
                ? 'Checking your message with the on-device guard…'
                : retrying
                  ? 'The cloud model is busy. Trying again…'
                  : 'Asking the cloud model…'}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-zinc-100 bg-zinc-50/40 p-3.5 sm:p-4 dark:border-white/[0.06] dark:bg-white/[0.015]">
          {disabled && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <WifiOff aria-hidden className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400" />
              {!cloudReady ? 'Cloud features are not configured in this build.' : 'The advisor needs a connection. Labeling and review still work offline.'}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-zinc-200/90 bg-white p-1.5 transition-colors focus-within:border-zinc-900 dark:border-white/[0.1] dark:bg-[#111114] dark:focus-within:border-zinc-400">
            <label htmlFor="advisor-input" className="sr-only">
              Ask about your totals
            </label>
            <textarea
              ref={inputRef}
              id="advisor-input"
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="Ask about your totals, e.g. “What did I spend on travel this month?”"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus-visible:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            <Button
              variant="primary"
              type="submit"
              aria-label="Send"
              className="size-9 shrink-0 rounded-lg px-0"
              disabled={disabled || busy !== false || !draft.trim()}
            >
              <ArrowUp aria-hidden className="size-4" />
            </Button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <ShieldCheck aria-hidden className="size-3 shrink-0 text-emerald-700 dark:text-emerald-400" />
            Messages with transaction details or merchant names from your data are blocked on this device before sending.
          </p>
        </form>
      </Card>
    </div>
  );
}

function EmptyChat({
  onPick,
  onTestGuard,
  disabled,
}: {
  onPick: (text: string) => void;
  onTestGuard: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-5 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl border border-zinc-200/80 bg-zinc-50 text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-300">
        <ShieldCheck aria-hidden className="size-5 text-emerald-700 dark:text-emerald-400" />
      </span>
      <h2 className="mt-3.5 text-base font-semibold tracking-tight text-zinc-950 dark:text-white">Ask about your totals</h2>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500 sm:text-[13px] dark:text-zinc-400">
        Pick a question below and watch the Data Boundary panel — only aggregated numbers ever cross to the cloud.
      </p>

      <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/40 px-3.5 py-2.5 text-left text-xs font-medium text-zinc-700 transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:pointer-events-none disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-zinc-300 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.05] dark:hover:text-white"
          >
            <span className="leading-snug">{s}</span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onTestGuard}
        className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 py-1.5 text-xs font-medium text-rose-800 transition-colors hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-50 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
      >
        <ShieldAlert aria-hidden className="size-3.5" />
        Test the on-device guard with a sample bank row
      </button>
    </div>
  );
}

function Message({ item }: { item: ChatItem }) {
  if (item.kind === 'user') {
    return (
      <div className="flex flex-col items-end gap-1">
        <p
          className={`max-w-[85%] rounded-xl rounded-br-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
            item.status === 'blocked'
              ? 'border border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200'
              : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
          }`}
        >
          {item.text}
        </p>
        {item.status === 'blocked' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            <Ban aria-hidden className="size-3" /> Not sent
          </span>
        )}
      </div>
    );
  }

  if (item.kind === 'blocked') {
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-xl border border-rose-200/80 bg-rose-50/60 p-4 text-sm text-rose-950 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100"
      >
        <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <div>
          <p className="text-[13px] font-semibold text-rose-950 dark:text-rose-100">Blocked on this device. Nothing was sent.</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-900/90 dark:text-rose-200">Why: {item.reasons.join('; ')}.</p>
          <p className="mt-1.5 text-xs text-rose-800/85 dark:text-rose-300">
            Ask about totals or categories instead, for example &ldquo;How much did I spend on travel this month?&rdquo;
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === 'call') {
    const json = JSON.stringify(item.result, null, 2);
    return (
      <details className="group overflow-hidden rounded-lg border border-emerald-200/75 bg-emerald-50/40 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
        <summary className="flex list-none items-center gap-2 px-3.5 py-2 text-emerald-950 transition-colors hover:bg-emerald-50/70 dark:text-emerald-100 dark:hover:bg-emerald-500/10">
          <Cpu aria-hidden className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>
            Cloud asked this device: <span className="font-semibold">{item.label}</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-emerald-800 dark:text-emerald-300">
            <span className="group-open:hidden">Inspect totals</span>
            <span className="hidden group-open:inline">Hide</span>
            <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <PayloadViewer
          title="Totals returned by local function"
          content={json}
          accent="device"
          maxHeightClass="max-h-56"
          className="rounded-none border-0 border-t border-zinc-800"
        />
      </details>
    );
  }

  if (item.kind === 'assistant') {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <div className="max-w-[88%] rounded-xl rounded-bl-sm border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 text-zinc-800 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-zinc-200">
          <RichText text={item.text} />
        </div>
        <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <span aria-hidden className="size-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
          Cloud · {CLOUD_MODEL}
        </span>
      </div>
    );
  }

  return (
    <p
      role="alert"
      className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
    >
      {item.text}
    </p>
  );
}
