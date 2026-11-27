import { CircleCheck, Cpu, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { openSetup } from '../lib/state/actions';
import { deviceStore, enableOnDeviceAi, type DeviceState } from '../lib/state/device';
import { useStore } from '../lib/util/store';
import { Badge, Button, ProgressBar } from './ui';

const CHIP: Record<DeviceState['status'], { text: string; tone: 'device' | 'review' | 'neutral' }> = {
  checking: { text: 'Checking on-device AI', tone: 'neutral' },
  available: { text: 'On-device AI ready', tone: 'device' },
  downloadable: { text: 'On-device AI: download needed', tone: 'review' },
  downloading: { text: 'On-device AI downloading', tone: 'review' },
  unavailable: { text: 'On-device AI unavailable', tone: 'review' },
  'api-missing': { text: 'On-device AI unavailable', tone: 'review' },
};

export function ModelStatusChip() {
  const device = useStore(deviceStore);
  const chip = device.downloading ? CHIP.downloading : CHIP[device.status];
  return (
    <a
      href="#/welcome"
      title="View on-device AI setup"
      onClick={(event) => {
        event.preventDefault();
        openSetup();
      }}
      className="inline-flex rounded transition-opacity hover:opacity-85"
    >
      <Badge tone={chip.tone} className="py-1">
        <Cpu aria-hidden className="size-3.5" />
        {chip.text}
      </Badge>
    </a>
  );
}

/** The user always knows the model state, and can start the download. */
export function ModelStatusCard() {
  const device = useStore(deviceStore);
  const percent = Math.round((device.progress ?? 0) * 100);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Cpu aria-hidden className="size-5 text-emerald-700" />
        <h3 className="font-semibold">On-device AI</h3>
        <span className="text-sm text-slate-600">Gemini Nano in Chrome</span>
      </div>

      {device.status === 'checking' && <p className="mt-3 text-sm text-slate-600">Checking this browser…</p>}

      {device.status === 'available' && !device.downloading && (
        <p className="mt-3 flex items-start gap-2 text-sm text-emerald-800">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Ready. Transactions are labeled inside this browser and never sent anywhere.
        </p>
      )}

      {(device.status === 'downloadable' || device.status === 'downloading' || device.downloading) && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-700">
            Chrome needs to download the model once. After that, labeling works offline.
          </p>
          {device.downloading || device.status === 'downloading' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                Downloading… {device.downloading ? `${percent}%` : ''}
              </div>
              <ProgressBar value={device.downloading ? percent : undefined} label="Model download progress" />
            </div>
          ) : (
            <Button variant="device" onClick={() => void enableOnDeviceAi()}>
              <Download aria-hidden className="size-4" /> Enable on-device AI
            </Button>
          )}
        </div>
      )}

      {(device.status === 'unavailable' || device.status === 'api-missing') && !device.downloading && (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p className="flex items-start gap-2 text-amber-900">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            Not available in this browser. The demo still works; rules label part of it.
          </p>
          <details className="group rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">How to turn it on</summary>
            <p className="mt-2 text-sm text-slate-700">
              Use Chrome on a desktop computer. Open <code className="rounded bg-white px-1 font-mono text-xs">chrome://flags</code>, enable{' '}
              <strong>Gemma 4 for Built-in AI</strong>, and relaunch Chrome.
            </p>
          </details>
        </div>
      )}

      {device.error && <p className="mt-2 text-sm text-rose-800">Download failed: {device.error}</p>}
    </div>
  );
}
