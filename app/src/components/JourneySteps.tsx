// Stepper for the whole product journey, shown above every working screen.
// Judges and users see the complete arc: import, label on device, review, export.

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
    { id: 'import', title: 'Import', status: imported ? `${counts.total} transactions` : 'Add a bank CSV' },
    {
      id: 'transactions',
      title: 'Label on device',
      status: !imported
        ? 'Gemini Nano in Chrome'
        : labeling.status === 'running'
          ? `${labeling.where === 'cloud' ? 'Cloud, with consent' : 'Labeling'} ${labeling.done}/${labeling.total}`
          : labeled
            ? 'All labeled'
            : `${counts.waiting} waiting`,
    },
    {
      id: 'review',
      title: 'Review',
      status: !labeled && counts.review === 0 ? 'Your decisions' : counts.review > 0 ? `${counts.review} to decide` : 'Nothing to decide',
    },
    { id: 'summary', title: 'Export', status: exported ? 'CSV saved' : reviewed ? 'Ready to export' : 'Business CSV' },
  ];
  const done = [imported, labeled, reviewed, exported];
  const completedCount = done.filter(Boolean).length;
  const firstOpen = done.findIndex((d) => !d);
  const steps: Step[] = raw.map((s, i) => ({ ...s, state: done[i] ? 'done' : i === firstOpen ? 'current' : 'todo' }));

  return (
    <nav
      aria-label="Progress"
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_4px_14px_-4px_rgba(15,23,42,0.05)]"
    >
      <ol className="grid grid-cols-2 gap-1 p-1.5 md:grid-cols-4 md:gap-0">
        {steps.map((step, i) => {
          const here = step.id === route;
          return (
            <li key={step.id} className="relative flex items-center">
              <a
                href={`#/${step.id}`}
                aria-current={here ? 'step' : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
                  here
                    ? 'bg-ink-50/80 ring-1 ring-ink-200/80 ring-inset'
                    : 'hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    step.state === 'done'
                      ? 'bg-emerald-600 text-white shadow-[0_2px_6px_-1px_rgba(5,150,105,0.45)]'
                      : step.state === 'current'
                        ? 'bg-ink-800 text-white shadow-[0_2px_6px_-1px_rgba(23,50,86,0.35)] ring-4 ring-ink-100'
                        : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/90'
                  }`}
                >
                  {step.state === 'done' ? <Check aria-hidden className="size-4" strokeWidth={2.75} /> : i + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className={`block text-sm font-semibold ${here ? 'text-ink-900' : 'text-slate-900'}`}>{step.title}</span>
                  <span
                    className={`mt-0.5 block truncate text-xs ${
                      step.state === 'current' && step.id === 'review'
                        ? 'font-semibold text-amber-800'
                        : step.state === 'done'
                          ? 'text-emerald-800/90'
                          : 'text-slate-500'
                    }`}
                  >
                    {step.status}
                  </span>
                </span>
                <span className="sr-only">{step.state === 'done' ? '(done)' : step.state === 'current' ? '(next step)' : ''}</span>
              </a>
              {i < steps.length - 1 && (
                <ChevronRight aria-hidden className="hidden size-4 shrink-0 text-slate-300 md:block" />
              )}
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="h-[3px] w-full bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-emerald-500 to-ink-700 transition-[width] duration-500 ease-out"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>
    </nav>
  );
}
