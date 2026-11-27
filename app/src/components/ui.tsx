import { Check, Copy, Lock, Moon, Sun } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { themeStore, toggleTheme } from '../lib/state/theme';
import { useStore } from '../lib/util/store';

type Variant = 'primary' | 'secondary' | 'ghost' | 'device' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500',
  secondary:
    'bg-white text-zinc-900 border border-zinc-200/90 hover:bg-zinc-50 hover:border-zinc-300 dark:bg-[#16161a] dark:text-zinc-100 dark:border-white/[0.1] dark:hover:bg-white/[0.06] dark:hover:border-white/[0.16] disabled:text-zinc-400 disabled:hover:bg-white dark:disabled:hover:bg-[#16161a]',
  ghost:
    'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100 disabled:text-zinc-400 disabled:hover:bg-transparent',
  device:
    'bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400 disabled:bg-emerald-200 disabled:text-emerald-700/60 dark:disabled:bg-emerald-950 dark:disabled:text-emerald-700',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:text-white dark:hover:bg-rose-400 disabled:bg-rose-200 dark:disabled:bg-rose-950',
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
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium transition-colors duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

type ProgressTone = 'device' | 'cloud' | 'ink';

const PROGRESS_TRACK: Record<ProgressTone, string> = {
  device: 'bg-zinc-100 dark:bg-white/[0.06]',
  cloud: 'bg-zinc-100 dark:bg-white/[0.06]',
  ink: 'bg-zinc-100 dark:bg-white/[0.06]',
};

const PROGRESS_FILL: Record<ProgressTone, string> = {
  device: 'bg-emerald-600 dark:bg-emerald-400',
  cloud: 'bg-indigo-600 dark:bg-indigo-400',
  ink: 'bg-zinc-900 dark:bg-zinc-100',
};

export function ProgressBar({ value, label, tone = 'device' }: { value?: number; label: string; tone?: ProgressTone }) {
  const determinate = value !== undefined;
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : undefined;
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${PROGRESS_TRACK[tone]}`}
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
  device: 'bg-emerald-50 text-emerald-800 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  cloud: 'bg-indigo-50 text-indigo-800 border-indigo-200/70 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20',
  review: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  danger: 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
  neutral: 'bg-zinc-100/90 text-zinc-600 border-zinc-200/70 dark:bg-white/[0.06] dark:text-zinc-300 dark:border-white/[0.08]',
  ink: 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111114] ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 ${className}`}
    >
      <Lock className="size-3.5" strokeWidth={2.2} />
    </span>
  );
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-w-5 items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium text-zinc-600 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-zinc-300 ${className}`}
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
          ? 'text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.08] dark:hover:text-zinc-100'
      }`}
    >
      {copied ? <Check aria-hidden className="size-3 text-emerald-500" /> : <Copy aria-hidden className="size-3" />}
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
      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
    >
      {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
    </button>
  );
}
