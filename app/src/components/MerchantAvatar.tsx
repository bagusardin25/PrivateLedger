// Deterministic monogram avatar for merchants so transaction tables and review
// cards scan quickly with refined, restrained jewel-tone hues.

const PALETTES = [
  'bg-ink-50 text-ink-800 ring-ink-200/80 dark:bg-indigo-950/75 dark:text-indigo-200 dark:ring-indigo-700/60',
  'bg-teal-50 text-teal-800 ring-teal-200/80 dark:bg-teal-950/75 dark:text-teal-300 dark:ring-teal-700/60',
  'bg-violet-50 text-violet-800 ring-violet-200/80 dark:bg-violet-950/75 dark:text-violet-300 dark:ring-violet-700/60',
  'bg-amber-50 text-amber-900 ring-amber-200/80 dark:bg-amber-950/75 dark:text-amber-300 dark:ring-amber-700/60',
  'bg-stone-100 text-zinc-700 ring-stone-200/90 dark:bg-zinc-800/90 dark:text-zinc-200 dark:ring-white/10',
  'bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/75 dark:text-rose-300 dark:ring-rose-700/60',
];

function initials(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function MerchantAvatar({
  name,
  size = 'md',
  className = '',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const palette = PALETTES[hash(name.toLowerCase()) % PALETTES.length];
  const dims = size === 'lg' ? 'size-12 rounded-2xl text-sm' : size === 'sm' ? 'size-7 rounded-lg text-[10px]' : 'size-8 rounded-xl text-[11px]';
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center font-bold tracking-tight ring-1 ring-inset ${dims} ${palette} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
