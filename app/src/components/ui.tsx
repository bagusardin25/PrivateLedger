import { Check, Copy, Lock, Moon, Sun } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { themeStore, toggleTheme } from '../lib/state/theme';
import { useStore } from '../lib/util/store';

type Variant = 'primary' | 'secondary' | 'ghost' | 'device' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-ink-700 to-ink-800 text-white shadow-[0_1px_2px_rgba(12,13,36,0.24),inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-ink-900/20 hover:from-ink-600 hover:to-ink-700 dark:from-indigo-400 dark:to-indigo-500 dark:text-zinc-950 dark:ring-indigo-300/30 dark:hover:from-indigo-300 dark:hover:to-indigo-400 disabled:from-stone-300 disabled:to-stone-300 disabled:text-white/90 disabled:shadow-none disabled:ring-transparent dark:disabled:from-zinc-800 dark:disabled:to-zinc-800 dark:disabled:text-zinc-500',
  secondary:
    'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(24,24,27,0.05)] ring-1 ring-inset ring-stone-200/95 hover:bg-stone-50 hover:ring-stone-300 dark:bg-zinc-900/90 dark:text-zinc-100 dark:ring-white/10 dark:hover:bg-zinc-800 dark:hover:ring-white/20 disabled:text-zinc-400 disabled:shadow-none',
  ghost:
    'text-zinc-600 hover:bg-stone-200/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent',
  device:
    'bg-gradient-to-b from-teal-700 to-teal-800 text-white shadow-[0_1px_2px_rgba(15,118,110,0.24),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-teal-900/20 hover:from-teal-600 hover:to-teal-700 dark:from-teal-500 dark:to-teal-600 dark:text-zinc-950 disabled:from-teal-300 disabled:to-teal-300 disabled:shadow-none',
  danger:
    'bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-[0_1px_2px_rgba(136,19,55,0.24),inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-rose-800/20 hover:from-rose-500 hover:to-rose-600 disabled:from-rose-300 disabled:to-rose-300 disabled:shadow-none',
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type ProgressTone = 'device' | 'cloud' | 'ink';

const PROGRESS_TRACK: Record<ProgressTone, string> = {
  device: 'bg-teal-100/80 dark:bg-teal-950/80',
  cloud: 'bg-indigo-100/80 dark:bg-indigo-950/80',
  ink: 'bg-stone-200/80 dark:bg-zinc-800',
};

const PROGRESS_FILL: Record<ProgressTone, string> = {
  device: 'bg-gradient-to-r from-teal-700 to-emerald-500 dark:from-teal-400 dark:to-emerald-400',
  cloud: 'bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-indigo-400 dark:to-violet-400',
  ink: 'bg-gradient-to-r from-ink-800 to-ink-500 dark:from-indigo-400 dark:to-teal-400',
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
  device: 'bg-teal-50/90 text-teal-900 ring-teal-200/85 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-700/55',
  cloud: 'bg-indigo-50/90 text-indigo-900 ring-indigo-200/85 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-700/55',
  review: 'bg-amber-50/95 text-amber-900 ring-amber-200/90 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-700/55',
  danger: 'bg-rose-50/95 text-rose-900 ring-rose-200/90 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-700/55',
  neutral: 'bg-stone-100/90 text-zinc-700 ring-stone-200/85 dark:bg-zinc-800/90 dark:text-zinc-300 dark:ring-white/10',
  ink: 'bg-ink-50 text-ink-800 ring-ink-200/85 dark:bg-indigo-950/70 dark:text-indigo-200 dark:ring-indigo-700/60',
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
      className={`rounded-2xl border border-stone-200/85 bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.03),0_8px_24px_-10px_rgba(24,24,27,0.06)] dark:border-white/[0.08] dark:bg-[#12131c] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_28px_-10px_rgba(0,0,0,0.55)] ${className}`}
    >
      {children}
    </section>
  );
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-ink-600 via-ink-800 to-ink-950 text-white shadow-[0_3px_10px_-2px_rgba(30,32,88,0.5),inset_0_1px_0_rgba(255,255,255,0.22)] dark:from-indigo-400 dark:via-indigo-600 dark:to-ink-900 ${className}`}
    >
      <Lock className="size-4" strokeWidth={2.25} />
    </span>
  );
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-w-5 items-center justify-center rounded-md border border-stone-300/90 bg-white px-1.5 py-0.5 font-mono text-[11px] leading-none font-semibold text-zinc-700 shadow-[0_1px_0_rgba(24,24,27,0.08)] dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[0_1px_0_rgba(0,0,0,0.5)] ${className}`}
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
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
        dark
          ? 'text-zinc-300 hover:bg-white/10 hover:text-white'
          : 'text-zinc-600 hover:bg-stone-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
    >
      {copied ? <Check aria-hidden className="size-3 text-teal-400" /> : <Copy aria-hidden className="size-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function ThemeToggle() {
  const { theme } = useStore(themeStore);
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex size-8 items-center justify-center rounded-full bg-stone-100/90 text-zinc-600 ring-1 ring-stone-200/90 transition-colors hover:bg-stone-200/80 hover:text-zinc-950 dark:bg-white/[0.06] dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/[0.12] dark:hover:text-white"
    >
      {dark ? <Sun aria-hidden className="size-3.5 text-amber-300" /> : <Moon aria-hidden className="size-3.5" />}
    </button>
  );
}
