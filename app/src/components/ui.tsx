import { Check, Copy, Lock, Moon, Sun } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { themeStore, toggleTheme } from '../lib/state/theme';
import { useStore } from '../lib/util/store';

type Variant = 'primary' | 'secondary' | 'ghost' | 'device' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-inverse text-on-inverse hover:bg-inverse-hover disabled:bg-emphasis disabled:text-fg-faint',
  secondary:
    'bg-raised text-fg border border-line hover:bg-subtle hover:border-line-strong disabled:text-fg-faint disabled:hover:bg-raised',
  ghost:
    'text-fg-secondary hover:bg-subtle hover:text-fg disabled:text-fg-faint disabled:hover:bg-transparent',
  device:
    'bg-emerald-700 text-on-inverse hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:bg-emerald-200 disabled:text-emerald-700/60 dark:disabled:bg-emerald-950 dark:disabled:text-emerald-700',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400 disabled:bg-rose-200 dark:disabled:bg-rose-950',
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
  device: 'bg-subtle',
  cloud: 'bg-subtle',
  ink: 'bg-subtle',
};

const PROGRESS_FILL: Record<ProgressTone, string> = {
  device: 'bg-device',
  cloud: 'bg-cloud',
  ink: 'bg-inverse',
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
  device: 'bg-device-soft text-device-fg border-device-line',
  cloud: 'bg-cloud-soft text-cloud-fg border-cloud-line',
  review: 'bg-review-soft text-review-fg border-review-line',
  danger: 'bg-danger-soft text-danger-fg border-danger-line',
  neutral: 'bg-subtle text-fg-secondary border-line',
  ink: 'bg-inverse text-on-inverse border-inverse',
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
      className={`rounded-xl border border-line bg-surface ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex size-7 items-center justify-center rounded-lg bg-inverse text-on-inverse ${className}`}
    >
      <Lock className="size-3.5" strokeWidth={2.2} />
    </span>
  );
}

export function Kbd({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={`inline-flex min-w-5 items-center justify-center rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium text-fg-secondary ${className}`}
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
          : 'text-fg-muted hover:bg-subtle hover:text-fg'
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
      className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
    >
      {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
    </button>
  );
}
