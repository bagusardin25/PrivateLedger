// What happens when on-device AI is not ready. Rows never move to the cloud on
// their own; the user picks one of three paths, and the cloud path shows
// exactly what will be sent before anything leaves the device.

import { ChevronDown, Cloud, Cpu, Download, Hand, Laptop, LoaderCircle, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { labelPendingByHand, openSetup } from '../lib/state/actions';
import { getConsentPreview, runCloudLabelingWithConsent, type ConsentPreview } from '../lib/ai/consentLabeling';
import { deviceStore, enableOnDeviceAi, useOnline } from '../lib/state/device';
import { cloudReady } from '../lib/ai/firebase';
import { plural } from '../lib/util/format';
import { CLOUD_MODEL } from '../lib/ai/models';
import { useStore } from '../lib/util/store';
import { PayloadViewer } from './PayloadViewer';
import { Badge, Button, ProgressBar } from './ui';

export function NoModelChoices({ waiting }: { waiting: number }) {
  const [preview, setPreview] = useState<ConsentPreview>();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const online = useOnline();
  const device = useStore(deviceStore);
  const cloudPossible = online && cloudReady;
  const downloading = device.downloading || device.status === 'downloading';
  const downloadable = device.status === 'downloadable';

  const openConsent = async () => {
    setLoading(true);
    setPreview(await getConsentPreview());
    setLoading(false);
  };

  if (preview) {
    const canSend = preview.isDemo || agreed;
    return (
      <section
        aria-labelledby="consent-title"
        className="rounded-xl border border-indigo-200/80 bg-white p-5 dark:border-indigo-500/25 dark:bg-[#111114]"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Cloud aria-hidden className="size-4" />
          </span>
          <h3 id="consent-title" className="text-sm font-semibold text-zinc-950 dark:text-white">
            Send {plural(preview.merchants, 'row')} to the cloud?
          </h3>
          {preview.isDemo ? <Badge tone="neutral">Demo data · invented transactions</Badge> : <Badge tone="review">Your real transactions</Badge>}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Cloud aria-hidden className="size-3.5" />
              Sent to Gemini ({CLOUD_MODEL})
            </dt>
            <dd className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              One bank description per merchant and whether money came in or went out: {plural(preview.merchants, 'row')} in{' '}
              {plural(preview.requests, 'request')}, through Firebase AI Logic.
            </dd>
          </div>
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/60 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Laptop aria-hidden className="size-3.5" />
              Stays on this device
            </dt>
            <dd className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              Amounts, dates, your business profile, and the other rows. Labels come back and are applied here to all {preview.rows} rows.
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          The data boundary panel will count these as <span className="font-medium text-zinc-900 dark:text-white">sent with consent</span>
          {preview.isDemo ? ', separately from your own data.' : '.'}
        </p>

        <details className="group mt-3 overflow-hidden rounded-lg border border-zinc-200/80 dark:border-white/[0.08]">
          <summary className="flex list-none items-center justify-between bg-zinc-50/80 px-3.5 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100/70 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.06]">
            <span>Inspect exact text of the first request</span>
            <ChevronDown aria-hidden className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
          </summary>
          <PayloadViewer
            title="First cloud request payload"
            content={preview.firstRequest}
            accent="cloud"
            maxHeightClass="max-h-56"
            className="rounded-none border-0 border-t border-zinc-800"
          />
        </details>

        {!preview.isDemo && (
          <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 text-xs text-zinc-800 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-zinc-200">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 rounded accent-zinc-900" />
            <span>I understand these bank descriptions will leave this device.</span>
          </label>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!canSend || !cloudPossible}
            onClick={() => {
              setPreview(undefined);
              void runCloudLabelingWithConsent();
            }}
          >
            <Cloud aria-hidden className="size-3.5" /> Send {plural(preview.merchants, 'row')} to the cloud
          </Button>
          <Button variant="ghost" onClick={() => setPreview(undefined)}>
            Cancel
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="no-model-title"
      className="rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-white/[0.08] dark:bg-[#111114]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <ShieldAlert aria-hidden className="size-4" />
        </span>
        <div>
          <h3 id="no-model-title" className="text-sm font-semibold text-zinc-950 dark:text-white">
            {downloading
              ? `Chrome is downloading the on-device model. ${plural(waiting, 'row')} are waiting, and nothing was sent.`
              : downloadable
                ? `On-device AI needs a one-time download. ${plural(waiting, 'row')} are waiting, and nothing was sent.`
                : `On-device AI isn't available here. ${plural(waiting, 'row')} are waiting, and nothing was sent.`}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Rules already labeled the rest. Choose how to finish these:</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {downloading ? (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3.5 dark:border-emerald-500/20 dark:bg-emerald-500/10" aria-live="polite">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            </span>
            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
              Downloading{device.downloading ? ` ${Math.round((device.progress ?? 0) * 100)}%` : '…'}
            </span>
            <ProgressBar value={device.downloading ? Math.round((device.progress ?? 0) * 100) : undefined} label="Model download progress" />
            <span className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">Labeling starts by itself when the model is ready.</span>
          </div>
        ) : downloadable ? (
          <Choice
            icon={<Download aria-hidden className="size-4 text-emerald-700 dark:text-emerald-400" />}
            tag="Recommended"
            title="Download on-device AI"
            detail="Chrome downloads the model once; then these rows are labeled here and never leave."
            onClick={() => void enableOnDeviceAi()}
          />
        ) : (
          <Choice
            icon={<Cpu aria-hidden className="size-4 text-emerald-700 dark:text-emerald-400" />}
            tag="Best privacy"
            title="Set up on-device AI"
            detail="Rows never leave this device. See what Chrome needs to enable Gemini Nano."
            onClick={openSetup}
          />
        )}
        <Choice
          icon={<Hand aria-hidden className="size-4 text-zinc-700 dark:text-zinc-300" />}
          title="Label by hand"
          detail="Decide each one quickly in Review mode. Nothing is sent."
          onClick={() => void labelPendingByHand()}
        />
        <Choice
          icon={
            loading ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin text-indigo-700 motion-reduce:animate-none dark:text-indigo-400" />
            ) : (
              <Cloud aria-hidden className="size-4 text-indigo-700 dark:text-indigo-400" />
            )
          }
          title="Use cloud AI"
          detail={
            cloudPossible
              ? 'Faster, but descriptions leave this device. You inspect the exact request first.'
              : 'Needs a connection and a configured Firebase project.'
          }
          disabled={!cloudPossible || loading}
          onClick={() => void openConsent()}
        />
      </div>
      {device.error && <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">Download failed: {device.error}</p>}
    </section>
  );
}

function Choice({
  icon,
  tag,
  title,
  detail,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  tag?: string;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-start gap-2 rounded-lg border border-zinc-200/80 bg-zinc-50/40 p-3.5 text-left transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 disabled:pointer-events-none disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.04]"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111114]">
          {icon}
        </span>
        {tag && <Badge tone="device">{tag}</Badge>}
      </div>
      <span className="text-[13px] font-semibold text-zinc-950 dark:text-white">{title}</span>
      <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{detail}</span>
    </button>
  );
}
