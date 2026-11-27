// Compact horizontal stepper for the product journey: import, label, review, export.

import { Check, ChevronRight } from 'lucide-react';
import type { Route } from '../lib/state/actions';
import { useJourneyCounts, useLastExport } from '../lib/state/journey';
import { labelingStore } from '../lib/ai/labelingRunner';
import { useStore } from '../lib/util/store';

type StepState = 'done' | 'current' | 'todo';

interface Step {
  id: Route;
  title: string;
  status: string;
  state: StepState;
}

export function JourneySteps({ route }: { route: Route }) {
  const counts = useJourneyCounts();
  const lastExport = useLastExport();
  const labeling = useStore(labelingStore);
  if (!counts) return null;

  const imported = counts.total > 0;
  const labeled = imported && counts.waiting === 0;
  const reviewed = labeled && counts.review === 0;
  const exported = reviewed && lastExport !== undefined;

  const raw: Omit<Step, 'state'>[] = [
    { id: 'import', title: 'Import', status: imported ? `${counts.total} rows` : 'Add CSV' },
    {
      id: 'transactions',
      title: 'Label on device',
      status: !imported
        ? 'Gemini Nano'
        : labeling.status === 'running'
          ? `${labeling.where === 'cloud' ? 'Cloud' : 'Labeling'} ${labeling.done}/${labeling.total}`
          : labeled
            ? 'All labeled'
            : `${counts.waiting} waiting`,
    },
    {
      id: 'review',
      title: 'Review',
      status: !labeled && counts.review === 0 ? 'Your decisions' : counts.review > 0 ? `${counts.review} to decide` : 'Complete',
    },
    { id: 'summary', title: 'Export', status: exported ? 'CSV saved' : reviewed ? 'Ready' : 'Business CSV' },
  ];
  const done = [imported, labeled, reviewed, exported];
  const completedCount = done.filter(Boolean).length;
  const firstOpen = done.findIndex((d) => !d);
  const steps: Step[] = raw.map((s, i) => ({ ...s, state: done[i] ? 'done' : i === firstOpen ? 'current' : 'todo' }));

  return (
    <nav
      aria-label="Progress"
      className="relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111114]"
    >
      <ol className="grid grid-cols-2 divide-y divide-zinc-100 md:grid-cols-4 md:divide-y-0 dark:divide-white/[0.06]">
        {steps.map((step, i) => {
          const here = step.id === route;
          return (
            <li key={step.id} className="relative flex items-center">
              <a
                href={`#/${step.id}`}
                aria-current={here ? 'step' : undefined}
                className={`group flex w-full items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150 ${
                  here
                    ? 'bg-zinc-50 dark:bg-white/[0.04]'
                    : 'hover:bg-zinc-50/70 dark:hover:bg-white/[0.025]'
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    step.state === 'done'
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950'
                      : step.state === 'current'
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                        : 'border border-zinc-200 text-zinc-500 dark:border-white/[0.12] dark:text-zinc-400'
                  }`}
                >
                  {step.state === 'done' ? <Check aria-hidden className="size-3" strokeWidth={2.75} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className={`truncate text-xs font-semibold ${here ? 'text-zinc-950 dark:text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {step.title}
                  </span>
                  <span
                    className={`truncate text-[11px] tabular-nums ${
                      step.state === 'current' && step.id === 'review'
                        ? 'font-medium text-amber-700 dark:text-amber-300'
                        : step.state === 'done'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    {step.status}
                  </span>
                </span>
                <span className="sr-only">{step.state === 'done' ? '(done)' : step.state === 'current' ? '(next step)' : ''}</span>
              </a>
              {i < steps.length - 1 && (
                <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-zinc-300 md:block dark:text-zinc-700" />
              )}
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="h-[2px] w-full bg-zinc-100 dark:bg-white/[0.05]">
        <div
          className="h-full bg-emerald-600 transition-[width] duration-500 ease-out dark:bg-emerald-400"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
