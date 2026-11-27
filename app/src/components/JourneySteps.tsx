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
    { id: 'import', title: 'Import', status: imported ? `${counts.total} transactions` : 'Add CSV' },
    {
      id: 'transactions',
      title: 'Sort',
      status: !imported
        ? 'On your laptop'
        : labeling.status === 'running'
          ? `${labeling.where === 'cloud' ? 'Cloud AI' : 'Sorting'} ${labeling.done}/${labeling.total}`
          : labeled
            ? 'All sorted'
            : `${counts.waiting} to sort`,
    },
    {
      id: 'review',
      title: 'Review',
      status: !labeled && counts.review === 0 ? 'Your call' : counts.review > 0 ? `${counts.review} to check` : 'Done',
    },
    { id: 'summary', title: 'Export', status: exported ? 'File saved' : reviewed ? 'Ready' : 'For your accountant' },
  ];
  const done = [imported, labeled, reviewed, exported];
  const completedCount = done.filter(Boolean).length;
  const firstOpen = done.findIndex((d) => !d);
  const steps: Step[] = raw.map((s, i) => ({ ...s, state: done[i] ? 'done' : i === firstOpen ? 'current' : 'todo' }));

  return (
    <nav
      aria-label="Progress"
      className="relative overflow-hidden rounded-xl border border-line bg-surface"
    >
      <ol className="grid grid-cols-2 divide-y divide-line-soft md:grid-cols-4 md:divide-y-0">
        {steps.map((step, i) => {
          const here = step.id === route;
          return (
            <li key={step.id} className="relative flex items-center">
              <a
                href={`#/${step.id}`}
                aria-current={here ? 'step' : undefined}
                className={`group flex w-full items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150 ${
                  here
                    ? 'bg-sunken'
                    : 'hover:bg-sunken'
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                    step.state === 'done'
                      ? 'bg-device text-on-inverse'
                      : step.state === 'current'
                        ? 'bg-inverse text-on-inverse'
                        : 'border border-line text-fg-muted'
                  }`}
                >
                  {step.state === 'done' ? <Check aria-hidden className="size-3" strokeWidth={2.75} /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-1.5">
                  <span className={`truncate text-xs font-semibold ${here ? 'text-fg' : 'text-fg-secondary'}`}>
                    {step.title}
                  </span>
                  <span
                    className={`truncate text-[11px] tabular-nums ${
                      step.state === 'current' && step.id === 'review'
                        ? 'font-medium text-review-fg'
                        : step.state === 'done'
                          ? 'text-device-fg'
                          : 'text-fg-muted'
                    }`}
                  >
                    {step.status}
                  </span>
                </span>
                <span className="sr-only">{step.state === 'done' ? '(done)' : step.state === 'current' ? '(next step)' : ''}</span>
              </a>
              {i < steps.length - 1 && (
                <ChevronRight aria-hidden className="hidden size-3.5 shrink-0 text-line-strong md:block" />
              )}
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="h-[2px] w-full bg-subtle">
        <div
          className="h-full bg-device transition-[width] duration-500 ease-out"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
