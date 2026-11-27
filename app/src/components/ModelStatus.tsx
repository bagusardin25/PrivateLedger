import { ChevronDown, CircleCheck, Cpu, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { openSetup } from '../lib/state/actions';
import { deviceStore, enableOnDeviceAi, type DeviceState } from '../lib/state/device';
import { useStore } from '../lib/util/store';
import { Badge, Button, ProgressBar } from './ui';

const CHIP: Record<DeviceState['status'], { text: string; shortText: string; dot: string }> = {
  checking: { text: 'Checking Laptop AI', shortText: 'Checking AI', dot: 'bg-zinc-400' },
  available: { text: 'Laptop AI ready', shortText: 'Laptop AI', dot: 'bg-device' },
  downloadable: { text: 'Download Laptop AI', shortText: 'Download AI', dot: 'bg-review' },
  downloading: { text: 'Downloading AI', shortText: 'Downloading', dot: 'bg-review' },
  unavailable: { text: 'Laptop AI not available', shortText: 'AI unavailable', dot: 'bg-review' },
  'api-missing': { text: 'Laptop AI not available', shortText: 'AI unavailable', dot: 'bg-review' },
};

export function ModelStatusChip() {
  const device = useStore(deviceStore);
  const isDownloading = device.downloading || device.status === 'downloading';
  const chip = isDownloading ? CHIP.downloading : CHIP[device.status];
  const percent = device.downloading ? Math.round((device.progress ?? 0) * 100) : undefined;

  return (
    <a
      href="/"
      title="Set up Laptop AI"
      onClick={(event) => {
        event.preventDefault();
        openSetup();
      }}
      className="inline-flex min-h-7 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-xs font-medium whitespace-nowrap text-fg-secondary transition-colors hover:border-line-strong hover:text-fg"
    >
      {isDownloading ? (
        <LoaderCircle aria-hidden className="size-3 animate-spin text-review-fg motion-reduce:animate-none" />
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
          <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-sunken text-fg-secondary">
            <Cpu aria-hidden className="size-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-fg">Laptop AI</h3>
            <p className="text-xs text-fg-muted">Gemini Nano, built into Chrome</p>
          </div>
        </div>
        {device.status === 'available' && !device.downloading && <Badge tone="device">Ready</Badge>}
        {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && <Badge tone="review">Setup</Badge>}
        {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && <Badge tone="neutral">Not available</Badge>}
      </div>

      {device.status === 'checking' && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-sunken px-3.5 py-2.5 text-sm text-fg-secondary">
          <LoaderCircle aria-hidden className="size-4 animate-spin text-zinc-400 motion-reduce:animate-none" />
          Checking this browser…
        </div>
      )}

      {device.status === 'available' && !device.downloading && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-device-line bg-device-soft px-3.5 py-3 text-sm text-device-ink">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-device-fg" />
          <span>Ready. Your transactions are sorted on your laptop and never sent anywhere.</span>
        </div>
      )}

      {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-relaxed text-fg-secondary">
            Chrome needs a one-time download. After that, sorting works even offline.
          </p>
          {device.downloading || device.status === 'downloading' ? (
            <div className="space-y-2 rounded-lg border border-device-line bg-device-soft p-3.5">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-device-ink">
                <span className="flex items-center gap-2">
                  <LoaderCircle aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />
                  Downloading Laptop AI…
                </span>
                {device.downloading && <span className="tabular-nums">{percent}%</span>}
              </div>
              <ProgressBar value={device.downloading ? percent : undefined} label="Laptop AI download progress" tone="device" />
            </div>
          ) : (
            <Button variant="device" onClick={() => void enableOnDeviceAi()}>
              <Download aria-hidden className="size-4" /> Turn on Laptop AI
            </Button>
          )}
        </div>
      )}

      {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && (
        <div className="mt-4 space-y-3 text-sm text-fg-secondary">
          <div className="flex items-start gap-2.5 rounded-lg border border-review-line bg-review-soft px-3.5 py-2.5 text-review-ink">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-review-fg" />
            <span>Not available in this browser. The demo still works: saved rules sort part of it right away.</span>
          </div>
          <details className="group rounded-lg border border-line bg-sunken px-3.5 py-2.5">
            <summary className="flex list-none items-center justify-between text-[13px] font-medium text-fg-secondary">
              <span>How to turn it on in Chrome</span>
              <ChevronDown aria-hidden className="size-4 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2.5 border-t border-line pt-2.5 text-xs leading-relaxed text-fg-secondary">
              Use Chrome on a desktop computer. Open{' '}
              <code className="rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-fg dark:bg-black/40">
                chrome://flags
              </code>
              , turn on <strong className="font-semibold text-fg">Gemma 4 for Built-in AI</strong>, and restart Chrome.
            </p>
          </details>
        </div>
      )}

      {device.error && (
        <p className="mt-3 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-xs text-danger-ink">
          Download didn't finish: {device.error}
        </p>
      )}
    </div>
  );
}
