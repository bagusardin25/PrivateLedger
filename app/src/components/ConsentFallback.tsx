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
        className="rounded-2xl border border-sky-200/90 bg-gradient-to-b from-sky-50/80 to-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700 ring-1 ring-sky-200">
            <Cloud aria-hidden className="size-4" />
          </span>
          <h3 id="consent-title" className="text-base font-semibold text-slate-900">
            Send {plural(preview.merchants, 'row')} to the cloud?
          </h3>
          {preview.isDemo ? <Badge tone="neutral">Demo data · invented transactions</Badge> : <Badge tone="review">Your real transactions</Badge>}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3.5 shadow-xs ring-1 ring-sky-200/90">
            <dt className="flex items-center gap-1.5 font-semibold text-sky-900">
              <Cloud aria-hidden className="size-4 text-sky-600" />
              Sent to Gemini ({CLOUD_MODEL})
            </dt>
            <dd className="mt-1.5 leading-relaxed text-slate-600">
              One bank description per merchant and whether money came in or went out: {plural(preview.merchants, 'row')} in{' '}
              {plural(preview.requests, 'request')}, through Firebase AI Logic.
            </dd>
          </div>
          <div className="rounded-xl bg-white p-3.5 shadow-xs ring-1 ring-emerald-200/90">
            <dt className="flex items-center gap-1.5 font-semibold text-emerald-900">
              <Laptop aria-hidden className="size-4 text-emerald-600" />
              Stays on this device
            </dt>
            <dd className="mt-1.5 leading-relaxed text-slate-600">
              Amounts, dates, your business profile, and the other rows. Labels come back and are applied here to all {preview.rows} rows.
            </dd>
          </div>
        </dl>

        <p className="mt-3.5 text-sm text-slate-600">
          The data boundary panel will count these as <span className="font-semibold text-slate-900">sent with consent</span>
          {preview.isDemo ? ', separately from your own data.' : '.'}
        </p>

        <details className="group mt-3 rounded-xl bg-slate-900/5 ring-1 ring-slate-200/80">
          <summary className="flex list-none items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-sky-900">
            <span>Inspect exact text of the first request</span>
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <pre className="code-inspector max-h-56 overflow-auto rounded-b-xl p-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {preview.firstRequest}
          </pre>
        </details>

        {!preview.isDemo && (
          <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-white px-3.5 py-3 text-sm text-slate-800 ring-1 ring-slate-200">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 rounded accent-ink-800" />
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
            <Cloud aria-hidden className="size-4" /> Send {plural(preview.merchants, 'row')} to the cloud
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
      className="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/80 via-amber-50/40 to-white p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-300/70">
          <ShieldAlert aria-hidden className="size-5" />
        </span>
        <div>
          <h3 id="no-model-title" className="font-semibold text-amber-950">
            {downloading
              ? `Chrome is downloading the on-device model. ${plural(waiting, 'row')} are waiting, and nothing was sent.`
              : downloadable
                ? `On-device AI needs a one-time download. ${plural(waiting, 'row')} are waiting, and nothing was sent.`
                : `On-device AI isn't available here. ${plural(waiting, 'row')} are waiting, and nothing was sent.`}
          </h3>
          <p className="mt-0.5 text-sm text-amber-900/90">Rules already labeled the rest. Choose how to finish these:</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {downloading ? (
          <div className="flex flex-col gap-2.5 rounded-xl bg-white p-4 shadow-xs ring-1 ring-emerald-300" aria-live="polite">
            <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />
            </span>
            <span className="font-semibold text-slate-900">
              Downloading{device.downloading ? ` ${Math.round((device.progress ?? 0) * 100)}%` : '…'}
            </span>
            <ProgressBar value={device.downloading ? Math.round((device.progress ?? 0) * 100) : undefined} label="Model download progress" />
            <span className="text-xs leading-relaxed text-slate-600">Labeling starts by itself when the model is ready.</span>
          </div>
        ) : downloadable ? (
          <Choice
            icon={<Download aria-hidden className="size-5 text-emerald-700" />}
            iconBg="bg-emerald-50 ring-emerald-200/80"
            tag="Recommended"
            title="Download on-device AI"
            detail="Chrome downloads the model once; then these rows are labeled here and never leave."
            onClick={() => void enableOnDeviceAi()}
          />
        ) : (
          <Choice
            icon={<Cpu aria-hidden className="size-5 text-emerald-700" />}
            iconBg="bg-emerald-50 ring-emerald-200/80"
            tag="Best privacy"
            title="Set up on-device AI"
            detail="Rows never leave this device. See what Chrome needs to enable Gemini Nano."
            onClick={openSetup}
          />
        )}
        <Choice
          icon={<Hand aria-hidden className="size-5 text-ink-700" />}
          iconBg="bg-ink-50 ring-ink-200/80"
          title="Label by hand"
          detail="Decide each one quickly in Review mode. Nothing is sent."
          onClick={() => void labelPendingByHand()}
        />
        <Choice
          icon={
            loading ? (
              <LoaderCircle aria-hidden className="size-5 animate-spin text-sky-700 motion-reduce:animate-none" />
            ) : (
              <Cloud aria-hidden className="size-5 text-sky-700" />
            )
          }
          iconBg="bg-sky-50 ring-sky-200/80"
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
      {device.error && <p className="mt-3 text-sm text-rose-800">Download failed: {device.error}</p>}
    </section>
  );
}

function Choice({
  icon,
  iconBg,
  tag,
  title,
  detail,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  iconBg: string;
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
      className="group flex flex-col items-start gap-2.5 rounded-xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/90 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md hover:ring-slate-300 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-55"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className={`flex size-9 items-center justify-center rounded-lg ring-1 ring-inset ${iconBg}`}>{icon}</span>
        {tag && <Badge tone="device">{tag}</Badge>}
      </div>
      <span className="font-semibold text-slate-900">{title}</span>
      <span className="text-xs leading-relaxed text-slate-600">{detail}</span>
    </button>
  );
}
