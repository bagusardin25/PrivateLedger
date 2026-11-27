// Zero-dependency crisp SVG donut chart for business spending by category.
// Syncs hovered/focused slice state with the adjacent ranked bar list.

import { formatMoney, plural } from '../lib/util/format';

export const CATEGORY_COLORS = [
  'var(--chart-0)',
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];

export interface CategorySlice {
  category: string;
  amount: number;
  count: number;
}

export function CategoryDonut({
  rows,
  total,
  active,
  onHover,
}: {
  rows: CategorySlice[];
  total: number;
  active?: string;
  onHover: (category?: string) => void;
}) {
  const size = 180;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = rows.length > 1 ? 2.5 : 0;

  const slices = rows.reduce<
    (CategorySlice & { share: number; length: number; dashOffset: number; color: string; nextOffset: number })[]
  >((acc, row, index) => {
    const startOffset = acc.at(-1)?.nextOffset ?? 0;
    const share = total > 0 ? row.amount / total : 0;
    const rawLen = share * circumference;
    const length = Math.max(0, rawLen - gap);
    acc.push({
      ...row,
      share,
      length,
      dashOffset: -startOffset,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      nextOffset: startOffset + rawLen,
    });
    return acc;
  }, []);

  const focused = slices.find((s) => s.category === active);

  return (
    <div className="relative mx-auto flex size-[180px] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 overflow-visible"
        role="img"
        aria-label={`Business spending breakdown totaling ${formatMoney(total)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-subtle"
        />
        {slices.map((slice) => {
          const isFocused = active === slice.category;
          const isDimmed = Boolean(active && !isFocused);
          return (
            <circle
              key={slice.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={isFocused ? stroke + 3 : stroke}
              strokeDasharray={`${slice.length} ${circumference}`}
              strokeDashoffset={slice.dashOffset}
              strokeLinecap="butt"
              opacity={isDimmed ? 0.3 : 1}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => onHover(slice.category)}
              onMouseLeave={() => onHover(undefined)}
            />
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-6 flex flex-col items-center justify-center text-center">
        <span className="max-w-[7.5rem] truncate text-[11px] font-medium text-fg-muted">
          {focused ? focused.category : 'Total business'}
        </span>
        <span className="mt-0.5 text-lg font-semibold tracking-tight text-fg tabular-nums">
          {formatMoney(focused ? focused.amount : total)}
        </span>
        <span className="mt-0.5 text-[11px] text-fg-muted tabular-nums">
          {focused ? `${Math.round(focused.share * 100)}% of spend` : plural(rows.length, 'category', 'categories')}
        </span>
      </div>
    </div>
  );
}
