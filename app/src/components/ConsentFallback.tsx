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
        className="rounded-xl border border-cloud-line bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cloud-soft text-cloud-fg">
            <Cloud aria-hidden className="size-4" />
          </span>
          <h3 id="consent-title" className="text-sm font-semibold text-fg">
            Send {plural(preview.merchants, 'bank description')} to Cloud AI?
          </h3>
          {preview.isDemo ? <Badge tone="neutral">Demo data · made-up transactions</Badge> : <Badge tone="review">Your real transactions</Badge>}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-sunken p-3.5">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-cloud-fg">
              <Cloud aria-hidden className="size-3.5" />
              Sent to Cloud AI
            </dt>
            <dd className="mt-1.5 text-xs leading-relaxed text-fg-secondary">
              One bank description per merchant, and whether money came in or went out. That is {plural(preview.merchants, 'description')} in{' '}
              {plural(preview.requests, 'request')} to Gemini ({CLOUD_MODEL}) through Firebase AI Logic.
            </dd>
          </div>
          <div className="rounded-lg border border-line bg-sunken p-3.5">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-device-fg">
              <Laptop aria-hidden className="size-3.5" />
              Stays on your laptop
            </dt>
            <dd className="mt-1.5 text-xs leading-relaxed text-fg-secondary">
              Amounts, dates, your business profile, and everything else. The answers come back and sort all {preview.rows} transactions here.
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-fg-muted">
          The Privacy panel will list these as <span className="font-medium text-fg">sent with your OK</span>
          {preview.isDemo ? ', separate from your own data.' : '.'}
        </p>

        <details className="group mt-3 overflow-hidden rounded-lg border border-line">
          <summary className="flex list-none items-center justify-between bg-sunken px-3.5 py-2 text-xs font-medium text-fg-secondary transition-colors hover:bg-subtle">
            <span>See the exact text of the first request</span>
            <ChevronDown aria-hidden className="size-3.5 text-zinc-400 transition-transform group-open:rotate-180" />
          </summary>
          <PayloadViewer
            title="First request to Cloud AI"
            content={preview.firstRequest}
            accent="cloud"
            maxHeightClass="max-h-56"
            className="rounded-none border-0 border-t border-zinc-800"
          />
        </details>

        {!preview.isDemo && (
          <label className="mt-4 flex items-start gap-2.5 rounded-lg border border-line bg-sunken px-3.5 py-2.5 text-xs text-fg-secondary">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 rounded accent-inverse" />
            <span>I understand these bank descriptions will leave my laptop.</span>
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
            <Cloud aria-hidden className="size-3.5" /> Send {plural(preview.merchants, 'description')}
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
      className="rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-review-soft text-review-fg">
          <ShieldAlert aria-hidden className="size-4" />
        </span>
        <div>
          <h3 id="no-model-title" className="text-sm font-semibold text-fg">
            {downloading
              ? `Chrome is downloading Laptop AI. ${plural(waiting, 'transaction')} left to sort, and nothing was sent.`
              : downloadable
                ? `Laptop AI needs a one-time download. ${plural(waiting, 'transaction')} left to sort, and nothing was sent.`
                : `Laptop AI isn't available in this browser. ${plural(waiting, 'transaction')} left to sort, and nothing was sent.`}
          </h3>
          <p className="mt-0.5 text-xs text-fg-muted">Your saved rules sorted the rest. Choose how to finish:</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {downloading ? (
          <div className="flex flex-col gap-2 rounded-lg border border-device-line bg-device-soft p-3.5" aria-live="polite">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white text-device-fg dark:bg-emerald-950">
              <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
            </span>
            <span className="text-sm font-semibold text-fg">
              Downloading{device.downloading ? ` ${Math.round((device.progress ?? 0) * 100)}%` : '…'}
            </span>
            <ProgressBar value={device.downloading ? Math.round((device.progress ?? 0) * 100) : undefined} label="Laptop AI download progress" />
            <span className="text-xs leading-relaxed text-fg-secondary">Sorting starts by itself when the download finishes.</span>
          </div>
        ) : downloadable ? (
          <Choice
            icon={<Download aria-hidden className="size-4 text-device-fg" />}
            tag="Recommended"
            title="Download Laptop AI"
            detail="A one-time download in Chrome. Then these transactions are sorted here and never leave."
            onClick={() => void enableOnDeviceAi()}
          />
        ) : (
          <Choice
            icon={<Cpu aria-hidden className="size-4 text-device-fg" />}
            tag="Best privacy"
            title="Set up Laptop AI"
            detail="Your transactions never leave your laptop. See what Chrome needs to turn it on."
            onClick={openSetup}
          />
        )}
        <Choice
          icon={<Hand aria-hidden className="size-4 text-fg-secondary" />}
          title="Sort by hand"
          detail="Decide each one quickly in Review. Nothing is sent."
          onClick={() => void labelPendingByHand()}
        />
        <Choice
          icon={
            loading ? (
              <LoaderCircle aria-hidden className="size-4 animate-spin text-cloud-fg motion-reduce:animate-none" />
            ) : (
              <Cloud aria-hidden className="size-4 text-cloud-fg" />
            )
          }
          title="Use Cloud AI"
          detail={
            cloudPossible
              ? 'Faster, but bank descriptions leave your laptop. You see the exact request first.'
              : 'Needs an internet connection and Cloud AI set up for this app.'
          }
          disabled={!cloudPossible || loading}
          onClick={() => void openConsent()}
        />
      </div>
      {device.error && <p className="mt-3 text-xs text-danger-fg">Download didn't finish: {device.error}</p>}
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
      className="group flex flex-col items-start gap-2 rounded-lg border border-line bg-sunken p-3.5 text-left transition-colors duration-150 hover:border-line-strong hover:bg-sunken disabled:pointer-events-none disabled:opacity-50"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg border border-line bg-surface">
          {icon}
        </span>
        {tag && <Badge tone="device">{tag}</Badge>}
      </div>
      <span className="text-[13px] font-semibold text-fg">{title}</span>
      <span className="text-xs leading-relaxed text-fg-muted">{detail}</span>
    </button>
  );
}
