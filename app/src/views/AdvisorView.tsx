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
          <strong key={idx} className="font-semibold text-fg">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="rounded border border-line bg-subtle px-1 py-0.5 font-mono text-xs text-fg"
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
              <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-fg-faint" />
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
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Advisor</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-fg-muted sm:text-sm">
            Cloud AI never sees a single transaction. It asks your laptop for totals, and you can see every answer below.
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
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-line-soft bg-sunken px-4 py-2 text-[11px] font-medium text-fg-muted">
          <span className="inline-flex items-center gap-1 text-device-fg">
            <ShieldCheck aria-hidden className="size-3" /> 1. Checked on your laptop
          </span>
          <ArrowRight aria-hidden className="size-3 text-line-strong" />
          <span className="inline-flex items-center gap-1 text-cloud-fg">
            <Cloud aria-hidden className="size-3" /> 2. Cloud AI thinks
          </span>
          <ArrowRight aria-hidden className="size-3 text-line-strong" />
          <span className="inline-flex items-center gap-1 text-device-fg">
            <Cpu aria-hidden className="size-3" /> 3. Your laptop sends totals only
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
            <div className="inline-flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-1.5 text-xs font-medium text-fg-secondary">
              <LoaderCircle
                aria-hidden
                className={`size-3.5 animate-spin motion-reduce:animate-none ${
                  busy === 'checking' ? 'text-device-fg' : 'text-cloud-fg'
                }`}
              />
              {busy === 'checking'
                ? 'Checking your message on your laptop…'
                : retrying
                  ? 'Cloud AI is busy. Trying again…'
                  : 'Asking Cloud AI…'}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="border-t border-line-soft bg-sunken p-3.5 sm:p-4">
          {disabled && (
            <p className="mb-3 flex items-center gap-2 rounded-lg border border-review-line bg-review-soft px-3 py-2 text-xs font-medium text-review-ink">
              <WifiOff aria-hidden className="size-3.5 shrink-0 text-review-fg" />
              {!cloudReady ? "Cloud AI isn't set up for this copy of the app." : 'The Advisor needs an internet connection. Sorting and review still work offline.'}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1.5 transition-colors focus-within:border-focus">
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
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-fg outline-none placeholder:text-fg-faint focus-visible:outline-none"
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
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-fg-muted">
            <ShieldCheck aria-hidden className="size-3 shrink-0 text-device-fg" />
            If a message includes transaction details or merchant names from your data, your laptop stops it before it&apos;s sent.
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
      <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-sunken text-fg-secondary">
        <ShieldCheck aria-hidden className="size-5 text-device-fg" />
      </span>
      <h2 className="mt-3.5 text-base font-semibold tracking-tight text-fg">Ask about your totals</h2>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-fg-muted sm:text-[13px]">
        Pick a question and watch the Privacy panel. Only totals ever go to the cloud.
      </p>

      <div className="mt-5 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-line bg-sunken px-3.5 py-2.5 text-left text-xs font-medium text-fg-secondary transition-colors duration-150 hover:border-line-strong hover:bg-subtle hover:text-fg disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="leading-snug">{s}</span>
            <ArrowRight aria-hidden className="size-3.5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-fg-secondary" />
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onTestGuard}
        className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border border-danger-line bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger-fg transition-colors hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-50"
      >
        <ShieldAlert aria-hidden className="size-3.5" />
        Test the privacy check with a sample bank line
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
              ? 'border border-danger-line bg-danger-soft text-danger-ink'
              : 'bg-inverse text-on-inverse'
          }`}
        >
          {item.text}
        </p>
        {item.status === 'blocked' && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger-fg">
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
        className="flex gap-3 rounded-xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-ink"
      >
        <Ban aria-hidden className="mt-0.5 size-4 shrink-0 text-danger-fg" />
        <div>
          <p className="text-[13px] font-semibold text-danger-ink">Stopped on your laptop. Nothing was sent.</p>
          <p className="mt-1 text-xs leading-relaxed text-danger-ink">Why: {item.reasons.join('; ')}.</p>
          <p className="mt-1.5 text-xs text-danger-fg">
            Ask about totals or categories instead, for example &ldquo;How much did I spend on travel this month?&rdquo;
          </p>
        </div>
      </div>
    );
  }

  if (item.kind === 'call') {
    const json = JSON.stringify(item.result, null, 2);
    return (
      <details className="group overflow-hidden rounded-lg border border-device-line bg-device-soft/60 text-xs">
        <summary className="flex list-none items-center gap-2 px-3.5 py-2 text-device-ink transition-colors hover:bg-device-soft">
          <Cpu aria-hidden className="size-3.5 shrink-0 text-device-fg" />
          <span>
            Cloud AI asked your laptop: <span className="font-semibold">{item.label}</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-device-fg">
            <span className="group-open:hidden">See totals</span>
            <span className="hidden group-open:inline">Hide</span>
            <ChevronDown aria-hidden className="size-3.5 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <PayloadViewer
          title="Totals your laptop sent back"
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
        <div className="max-w-[88%] rounded-xl rounded-bl-sm border border-line bg-sunken px-4 py-3 text-fg-secondary">
          <RichText text={item.text} />
        </div>
        <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-medium text-fg-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-cloud" />
          Cloud AI · {CLOUD_MODEL}
        </span>
      </div>
    );
  }

  return (
    <p
      role="alert"
      className="rounded-lg border border-review-line bg-review-soft px-3.5 py-2.5 text-xs text-review-ink"
    >
      {item.text}
    </p>
  );
}
