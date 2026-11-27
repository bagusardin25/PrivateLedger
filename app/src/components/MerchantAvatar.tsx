// Restrained monochrome monogram avatar for merchants so tables and review cards
// scan cleanly without visual clutter (Mercury / Ramp style).

const PALETTES = [
  'bg-subtle text-fg-secondary border-line',
  'bg-stone-100 text-stone-700 border-stone-200/80 dark:bg-white/[0.05] dark:text-zinc-300 dark:border-white/[0.08]',
  'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-white/[0.07] dark:text-zinc-200 dark:border-white/[0.09]',
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
  const dims =
    size === 'lg'
      ? 'size-11 rounded-xl text-xs'
      : size === 'sm'
        ? 'size-7 rounded-lg text-[10px]'
        : 'size-8 rounded-lg text-[11px]';
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center border font-semibold tracking-tight ${dims} ${palette} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
