// Stepper for the whole product journey, shown above every working screen.
// Judges and users see the complete arc: import, label on device, review, export.

import { Check } from 'lucide-react';
import type { Route } from '../lib/actions';
import { useJourneyCounts, useLastExport } from '../lib/journey';
import { labelingStore } from '../lib/labelingRunner';
import { useStore } from '../lib/store';

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
    { id: 'review', title: 'Review', status: !labeled && counts.review === 0 ? 'Your decisions' : counts.review > 0 ? `${counts.review} to decide` : 'Nothing to decide' },
    { id: 'summary', title: 'Export', status: exported ? 'CSV saved' : reviewed ? 'Ready' : 'Business CSV' },
  ];
  const done = [imported, labeled, reviewed, exported];
  const firstOpen = done.findIndex((d) => !d);
  const steps: Step[] = raw.map((s, i) => ({ ...s, state: done[i] ? 'done' : i === firstOpen ? 'current' : 'todo' }));

  return (
    <nav aria-label="Progress" className="rounded-xl bg-white px-2 py-2 shadow-sm ring-1 ring-slate-900/5">
      <ol className="grid grid-cols-2 gap-1 md:grid-cols-4">
        {steps.map((step, i) => {
          const here = step.id === route;
          return (
            <li key={step.id}>
              <a
                href={`#/${step.id}`}
                aria-current={here ? 'step' : undefined}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${here ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    step.state === 'done'
                      ? 'bg-emerald-600 text-white'
                      : step.state === 'current'
                        ? 'bg-ink-800 text-white ring-4 ring-ink-100'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {step.state === 'done' ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-semibold text-slate-900">{step.title}</span>
                  <span className={`block truncate text-xs ${step.state === 'current' && step.id === 'review' ? 'font-medium text-amber-800' : 'text-slate-600'}`}>
                    {step.status}
                  </span>
                </span>
                <span className="sr-only">{step.state === 'done' ? '(done)' : step.state === 'current' ? '(next step)' : ''}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
