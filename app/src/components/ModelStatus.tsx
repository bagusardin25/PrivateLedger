import { ChevronDown, CircleCheck, Cpu, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { openSetup } from '../lib/state/actions';
import { deviceStore, enableOnDeviceAi, type DeviceState } from '../lib/state/device';
import { useStore } from '../lib/util/store';
import { Badge, Button, ProgressBar } from './ui';

const CHIP: Record<DeviceState['status'], { text: string; shortText: string; tone: 'device' | 'review' | 'neutral'; dot?: string }> = {
  checking: { text: 'Checking on-device AI', shortText: 'Checking AI', tone: 'neutral', dot: 'bg-zinc-400' },
  available: { text: 'On-device AI ready', shortText: 'On-device AI', tone: 'device', dot: 'bg-teal-500' },
  downloadable: { text: 'Download on-device AI', shortText: 'Download AI', tone: 'review', dot: 'bg-amber-500' },
  downloading: { text: 'Downloading AI', shortText: 'Downloading', tone: 'review' },
  unavailable: { text: 'On-device AI unavailable', shortText: 'AI unavailable', tone: 'review', dot: 'bg-amber-500' },
  'api-missing': { text: 'On-device AI unavailable', shortText: 'AI unavailable', tone: 'review', dot: 'bg-amber-500' },
};

export function ModelStatusChip() {
  const device = useStore(deviceStore);
  const isDownloading = device.downloading || device.status === 'downloading';
  const chip = isDownloading ? CHIP.downloading : CHIP[device.status];
  const percent = device.downloading ? Math.round((device.progress ?? 0) * 100) : undefined;

  return (
    <a
      href="#/welcome"
      title="View on-device AI setup"
      onClick={(event) => {
        event.preventDefault();
        openSetup();
      }}
      className="inline-flex rounded-full transition-transform hover:scale-[1.01] active:scale-[0.99]"
    >
      <Badge tone={chip.tone} className="min-h-7 px-2.5 py-1">
        {isDownloading ? (
          <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
        ) : (
          <span className="relative flex size-2 items-center justify-center">
            {device.status === 'available' && (
              <span aria-hidden className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:hidden" />
            )}
            <span aria-hidden className={`relative inline-flex size-2 rounded-full ${chip.dot ?? 'bg-zinc-400'}`} />
          </span>
        )}
        <Cpu aria-hidden className="size-3.5 opacity-80" />
        {isDownloading && percent !== undefined ? (
          <span>Downloading {percent}%</span>
        ) : (
          <>
            <span className="xl:hidden">{chip.shortText}</span>
            <span className="hidden xl:inline">{chip.text}</span>
          </>
        )}
      </Badge>
    </a>
  );
}

/** The user always knows the model state, and can start the download. */
export function ModelStatusCard() {
  const device = useStore(deviceStore);
  const percent = Math.round((device.progress ?? 0) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-200/80 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-700/60">
            <Cpu aria-hidden className="size-5" />
          </span>
          <div>
            <h3 className="font-bold text-zinc-950 dark:text-white">On-device AI</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gemini Nano inside Chrome</p>
          </div>
        </div>
        {device.status === 'available' && !device.downloading && <Badge tone="device">Ready</Badge>}
        {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && <Badge tone="review">Setup</Badge>}
        {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && <Badge tone="neutral">Not detected</Badge>}
      </div>

      {device.status === 'checking' && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 px-3.5 py-3 text-sm text-zinc-600 ring-1 ring-stone-200/80 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-zinc-500 motion-reduce:animate-none" />
          Checking this browser…
        </div>
      )}

      {device.status === 'available' && !device.downloading && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-teal-50/80 px-3.5 py-3 text-sm text-teal-950 ring-1 ring-teal-200/80 dark:bg-teal-950/50 dark:text-teal-200 dark:ring-teal-800/60">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-400" />
          <span>Ready. Transactions are labeled inside this browser and never sent anywhere.</span>
        </div>
      )}

      {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Chrome needs to download the model once. After that, labeling works completely offline.
          </p>
          {device.downloading || device.status === 'downloading' ? (
            <div className="space-y-2.5 rounded-xl bg-teal-50/70 p-3.5 ring-1 ring-teal-200/80 dark:bg-teal-950/40 dark:ring-teal-800/60">
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-teal-950 dark:text-teal-200">
                <span className="flex items-center gap-2">
                  <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                  Downloading model…
                </span>
                {device.downloading && <span className="tabular-nums">{percent}%</span>}
              </div>
              <ProgressBar value={device.downloading ? percent : undefined} label="Model download progress" tone="device" />
            </div>
          ) : (
            <Button variant="device" onClick={() => void enableOnDeviceAi()}>
              <Download aria-hidden className="size-4" /> Enable on-device AI
            </Button>
          )}
        </div>
      )}

      {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && (
        <div className="mt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50/85 px-3.5 py-3 text-amber-950 ring-1 ring-amber-200/85 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800/60">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>Not available in this browser. The demo still works; rules label part of it immediately.</span>
          </div>
          <details className="group rounded-xl bg-stone-50/90 px-3.5 py-2.5 ring-1 ring-stone-200/85 dark:bg-white/[0.04] dark:ring-white/10">
            <summary className="flex list-none items-center justify-between text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              <span>How to turn it on in Chrome</span>
              <ChevronDown aria-hidden className="size-4 text-zinc-500 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2.5 border-t border-stone-200/80 pt-2.5 text-sm leading-relaxed text-zinc-600 dark:border-white/10 dark:text-zinc-300">
              Use Chrome on a desktop computer. Open{' '}
              <code className="rounded-md bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-900 ring-1 ring-stone-200 dark:bg-black/40 dark:text-indigo-300 dark:ring-white/10">
                chrome://flags
              </code>
              , enable <strong className="font-semibold text-zinc-900 dark:text-white">Gemma 4 for Built-in AI</strong>, and relaunch Chrome.
            </p>
          </details>
        </div>
      )}

      {device.error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800">
          Download failed: {device.error}
        </p>
      )}
    </div>
  );
}
