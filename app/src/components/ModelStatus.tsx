import { ChevronDown, CircleCheck, Cpu, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { openSetup } from '../lib/state/actions';
import { deviceStore, enableOnDeviceAi, type DeviceState } from '../lib/state/device';
import { useStore } from '../lib/util/store';
import { Badge, Button, ProgressBar } from './ui';

const CHIP: Record<DeviceState['status'], { text: string; shortText: string; dot: string }> = {
  checking: { text: 'Checking on-device AI', shortText: 'Checking AI', dot: 'bg-zinc-400' },
  available: { text: 'On-device AI ready', shortText: 'Local AI', dot: 'bg-emerald-600 dark:bg-emerald-400' },
  downloadable: { text: 'Download on-device AI', shortText: 'Download AI', dot: 'bg-amber-500 dark:bg-amber-400' },
  downloading: { text: 'Downloading AI', shortText: 'Downloading', dot: 'bg-amber-500 dark:bg-amber-400' },
  unavailable: { text: 'On-device AI unavailable', shortText: 'AI unavailable', dot: 'bg-amber-500 dark:bg-amber-400' },
  'api-missing': { text: 'On-device AI unavailable', shortText: 'AI unavailable', dot: 'bg-amber-500 dark:bg-amber-400' },
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
      className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-zinc-200/80 bg-white px-2.5 text-xs font-medium whitespace-nowrap text-zinc-700 transition-colors hover:border-zinc-300 hover:text-zinc-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300 dark:hover:border-white/[0.15] dark:hover:text-white"
    >
      {isDownloading ? (
        <LoaderCircle aria-hidden className="size-3 animate-spin text-amber-600 motion-reduce:animate-none dark:text-amber-400" />
      ) : (
        <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${chip.dot}`} />
      )}
      {isDownloading && percent !== undefined ? (
        <span className="tabular-nums">Downloading {percent}%</span>
      ) : (
        <>
          <span className="2xl:hidden">{chip.shortText}</span>
          <span className="hidden 2xl:inline">{chip.text}</span>
        </>
      )}
    </a>
  );
}

/** The user always knows the model state, and can start the download. */
export function ModelStatusCard() {
  const device = useStore(deviceStore);
  const percent = Math.round((device.progress ?? 0) * 100);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg border border-zinc-200/80 bg-zinc-50 text-zinc-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-300">
            <Cpu aria-hidden className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">On-device AI</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gemini Nano inside Chrome</p>
          </div>
        </div>
        {device.status === 'available' && !device.downloading && <Badge tone="device">Ready</Badge>}
        {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && <Badge tone="review">Setup</Badge>}
        {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && <Badge tone="neutral">Not detected</Badge>}
      </div>

      {device.status === 'checking' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3.5 py-2.5 text-sm text-zinc-600 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-zinc-300">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-zinc-400 motion-reduce:animate-none" />
          Checking this browser…
        </div>
      )}

      {device.status === 'available' && !device.downloading && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3.5 py-3 text-sm text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span>Ready. Transactions are labeled inside this browser and never sent anywhere.</span>
        </div>
      )}

      {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Chrome needs to download the model once. After that, labeling works completely offline.
          </p>
          {device.downloading || device.status === 'downloading' ? (
            <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/50 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                <span className="flex items-center gap-2">
                  <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
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
        <div className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <span>Not available in this browser. The demo still works; rules label part of it immediately.</span>
          </div>
          <details className="group rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
            <summary className="flex list-none items-center justify-between text-[13px] font-medium text-zinc-800 dark:text-zinc-200">
              <span>How to turn it on in Chrome</span>
              <ChevronDown aria-hidden className="size-4 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2.5 border-t border-zinc-200/75 pt-2.5 text-xs leading-relaxed text-zinc-600 dark:border-white/[0.07] dark:text-zinc-400">
              Use Chrome on a desktop computer. Open{' '}
              <code className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-900 dark:border-white/[0.1] dark:bg-black/40 dark:text-zinc-200">
                chrome://flags
              </code>
              , enable <strong className="font-semibold text-zinc-900 dark:text-white">Gemma 4 for Built-in AI</strong>, and relaunch Chrome.
            </p>
          </details>
        </div>
      )}

      {device.error && (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          Download failed: {device.error}
        </p>
      )}
    </div>
  );
}
