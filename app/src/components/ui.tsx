import { Check, Copy, Lock } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'device' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-ink-700 to-ink-800 text-white shadow-[0_1px_2px_rgba(15,23,42,0.2),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-ink-900/20 hover:from-ink-600 hover:to-ink-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-white/90 disabled:shadow-none disabled:ring-transparent',
  secondary:
    'bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-inset ring-slate-200/90 hover:bg-slate-50 hover:ring-slate-300 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-white',
  ghost:
    'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 disabled:text-slate-400 disabled:hover:bg-transparent',
  device:
    'bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[0_1px_2px_rgba(6,78,59,0.22),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-emerald-800/20 hover:from-emerald-500 hover:to-emerald-600 disabled:from-emerald-300 disabled:to-emerald-300 disabled:shadow-none',
  danger:
    'bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-[0_1px_2px_rgba(136,19,55,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-rose-800/20 hover:from-rose-500 hover:to-rose-600 disabled:from-rose-300 disabled:to-rose-300 disabled:shadow-none',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type ProgressTone = 'device' | 'cloud' | 'ink';

const PROGRESS_TRACK: Record<ProgressTone, string> = {
  device: 'bg-emerald-100/90',
  cloud: 'bg-sky-100/90',
  ink: 'bg-slate-200/80',
};

const PROGRESS_FILL: Record<ProgressTone, string> = {
  device: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
  cloud: 'bg-gradient-to-r from-sky-600 to-sky-500',
  ink: 'bg-gradient-to-r from-ink-800 to-ink-600',
};

export function ProgressBar({ value, label, tone = 'device' }: { value?: number; label: string; tone?: ProgressTone }) {
  const determinate = value !== undefined;
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : undefined;
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full ${PROGRESS_TRACK[tone]}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {determinate ? (
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${PROGRESS_FILL[tone]}`} style={{ width: `${clamped}%` }} />
      ) : (
        <div className={`indeterminate-bar h-full w-2/5 rounded-full ${PROGRESS_FILL[tone]}`} />
      )}
    </div>
  );
}

type Tone = 'device' | 'cloud' | 'review' | 'danger' | 'neutral' | 'ink';

const TONES: Record<Tone, string> = {
  device: 'bg-emerald-50/90 text-emerald-800 ring-emerald-200/90',
  cloud: 'bg-sky-50/90 text-sky-800 ring-sky-200/90',
  review: 'bg-amber-50/90 text-amber-900 ring-amber-200/90',
  danger: 'bg-rose-50/90 text-rose-800 ring-rose-200/90',
  neutral: 'bg-slate-100/90 text-slate-700 ring-slate-200/80',
  ink: 'bg-ink-50 text-ink-800 ring-ink-200/80',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-semibold tracking-[0.01em] whitespace-nowrap ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_6px_20px_-6px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </section>
  );
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-ink-600 via-ink-800 to-ink-950 text-white shadow-[0_2px_8px_-2px_rgba(23,50,86,0.5),inset_0_1px_0_rgba(255,255,255,0.22)] ${className}`}
    >
      <Lock className="size-4" strokeWidth={2.25} />
    </span>
  );
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-w-5 items-center justify-center rounded-md border border-slate-300/90 bg-white px-1.5 py-0.5 font-mono text-[11px] leading-none font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.08)] ${className}`}
    >
      {children}
    </kbd>
  );
}

export function CopyButton({ text, label = 'Copy', dark = false }: { text: string; label?: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be unavailable in restricted contexts.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      aria-label={copied ? 'Copied to clipboard' : label}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
        dark
          ? 'text-slate-300 hover:bg-white/10 hover:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {copied ? <Check aria-hidden className="size-3 text-emerald-400" /> : <Copy aria-hidden className="size-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
