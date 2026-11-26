import { Lock } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'device' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink-800 text-white hover:bg-ink-700 disabled:bg-slate-400',
  secondary: 'bg-white text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-700 hover:bg-slate-200/70 disabled:text-slate-400',
  device: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-300',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-300',
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, label }: { value?: number; label: string }) {
  const determinate = value !== undefined;
  const clamped = determinate ? Math.max(0, Math.min(100, value)) : undefined;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100"
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {determinate ? (
        <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300" style={{ width: `${clamped}%` }} />
      ) : (
        <div className="skeleton h-full w-1/2 rounded-full bg-emerald-500/60" />
      )}
    </div>
  );
}

type Tone = 'device' | 'cloud' | 'review' | 'danger' | 'neutral' | 'ink';

const TONES: Record<Tone, string> = {
  device: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cloud: 'bg-sky-50 text-sky-800 ring-sky-200',
  review: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  ink: 'bg-ink-50 text-ink-800 ring-ink-100',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 ${className}`}>{children}</section>;
}

export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex size-7 items-center justify-center rounded-md bg-ink-800 text-white ${className}`}>
      <Lock className="size-4" strokeWidth={2.25} />
    </span>
  );
}
