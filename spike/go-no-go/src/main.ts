import { firebaseSdkVersion, getFirebase, hasDebugToken, hasRealConfig } from './firebase';
import { FALLBACK_CLOUD_MODEL, createOnDeviceModels, type Models } from './models';
import { getDeviceStatus, type DeviceStatus } from './onDevice';
import { runSpeedComparison } from './speed';
import {
  THRESHOLDS,
  decide,
  runCloudPing,
  runExplainerTest,
  runFunctionCallingCheck,
  runGuardTest,
  runLabelerTest,
  runPreferOnDeviceCheck,
  runReporterCheck,
  runSearchComboCheck,
  type Gate,
} from './tests';

interface Report {
  tool: string;
  syntheticDataOnly: true;
  environment: Record<string, unknown>;
  thresholds: typeof THRESHOLDS;
  gates: Gate[];
  decision: string[];
  details: Record<string, unknown>;
  runs: { kind: string; startedAt: string; finishedAt: string }[];
}

const report: Report = {
  tool: 'private-ledger-go-no-go',
  syntheticDataOnly: true,
  environment: {},
  thresholds: THRESHOLDS,
  gates: [],
  decision: [],
  details: {},
  runs: [],
};

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main>
    <h1>Private Ledger: go/no-go test</h1>
    <p class="muted">Checks on-device and cloud inference through Firebase AI Logic. Uses synthetic transactions only.</p>

    <section>
      <h2>Environment</h2>
      <dl id="env"></dl>
    </section>

    <section>
      <h2>Run</h2>
      <div class="actions">
        <button id="enable" class="primary">1. Enable on-device AI</button>
        <button id="run-device">2. Run on-device tests</button>
        <button id="run-cloud">3. Run cloud tests</button>
        <button id="run-speed">4. Run speed comparison</button>
        <button id="copy">Copy results JSON</button>
      </div>
      <progress id="progress" max="1" value="0" hidden></progress>
      <p id="saved" class="muted" style="margin-top:12px"></p>
    </section>

    <section>
      <h2>Decision</h2>
      <ul id="decision"><li class="muted">No results yet.</li></ul>
    </section>

    <section>
      <h2>Results</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Check</th><th>Result</th><th>Details</th></tr></thead>
          <tbody id="gates"><tr><td colspan="4" class="muted">No results yet.</td></tr></tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Log</h2>
      <pre id="log"></pre>
    </section>
  </main>
`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const buttons = ['enable', 'run-device', 'run-cloud', 'run-speed'].map((id) => $<HTMLButtonElement>(id));
const progress = $<HTMLProgressElement>('progress');

function log(line: string): void {
  const el = $('log');
  el.textContent += `${new Date().toLocaleTimeString()}  ${line}\n`;
  el.scrollTop = el.scrollHeight;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function chromeVersion(): string {
  return navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'not Chrome';
}

const STATUS_TEXT: Record<DeviceStatus, string> = {
  available: 'available',
  downloadable: 'downloadable (click "Enable on-device AI")',
  downloading: 'downloading',
  unavailable: 'unavailable on this device or browser',
  'api-missing': 'LanguageModel API missing (enable the Chrome flag, see README)',
};

async function renderEnvironment(): Promise<DeviceStatus> {
  const status = await getDeviceStatus();
  report.environment = {
    chromeVersion: chromeVersion(),
    firebaseSdkVersion,
    firebaseConfig: hasRealConfig ? 'real project' : 'placeholder (on-device tests only)',
    appCheckDebugToken: hasDebugToken ? 'set' : 'not set',
    languageModelApi: status === 'api-missing' ? 'missing' : 'present',
    deviceStatus: status,
  };
  const rows: [string, string][] = [
    ['Chrome', chromeVersion()],
    ['Firebase JS SDK', firebaseSdkVersion],
    ['Firebase config', hasRealConfig ? 'Real project' : 'Placeholder: on-device tests only'],
    ['App Check debug token', hasDebugToken ? 'Set' : 'Not set'],
    ['On-device model', STATUS_TEXT[status]],
  ];
  $('env').innerHTML = rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  $<HTMLButtonElement>('run-cloud').disabled = !hasRealConfig;
  $<HTMLButtonElement>('run-cloud').title = hasRealConfig ? '' : 'Fill in .env.local first (see README).';
  return status;
}

function renderResults(): void {
  const prefixOrder = ['G', 'I', 'S'];
  const order = (g: Gate) => prefixOrder.indexOf(g.id[0]) * 100 + Number(g.id.slice(1));
  const gates = [...report.gates].sort((a, b) => order(a) - order(b));
  $('gates').innerHTML = gates
    .map(
      (g) => `<tr>
        <td>${g.id}</td>
        <td>${escapeHtml(g.name)}${g.threshold ? `<br><span class="muted">${escapeHtml(g.threshold)}</span>` : ''}</td>
        <td class="verdict ${g.verdict}">${g.verdict}</td>
        <td>${escapeHtml(g.summary)}</td>
      </tr>`,
    )
    .join('');
  report.decision = decide(report.gates);
  $('decision').innerHTML = report.decision.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
}

function merge(result: { gates: Gate[]; details: Record<string, unknown> }): void {
  for (const gate of result.gates) {
    report.gates = report.gates.filter((g) => g.id !== gate.id).concat(gate);
  }
  Object.assign(report.details, result.details);
  renderResults();
}

async function saveReport(): Promise<void> {
  try {
    const response = await fetch('/__results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    const body = (await response.json()) as { saved?: string };
    $('saved').textContent = body.saved ? `Saved to ${body.saved} (and results/latest.json).` : 'Could not save results.';
  } catch {
    $('saved').textContent = 'Could not save results to disk. Use "Copy results JSON".';
  }
}

async function withBusy(kind: string, task: () => Promise<void>): Promise<void> {
  buttons.forEach((b) => (b.disabled = true));
  const startedAt = new Date().toISOString();
  try {
    await task();
  } catch (error) {
    log(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    report.runs.push({ kind, startedAt, finishedAt: new Date().toISOString() });
    await renderEnvironment();
    buttons.forEach((b) => (b.disabled = false));
    $<HTMLButtonElement>('run-cloud').disabled = !hasRealConfig;
    await saveReport();
  }
}

let models: Models | undefined;
function onDeviceModels(): Models {
  models ??= createOnDeviceModels(getFirebase().ai);
  return models;
}

$('enable').addEventListener('click', () =>
  withBusy('enable-on-device', async () => {
    const before = await getDeviceStatus();
    log(`On-device model status: ${before}`);
    if (before === 'api-missing' || before === 'unavailable') {
      log('Cannot download: ' + STATUS_TEXT[before]);
      return;
    }
    progress.hidden = false;
    // Must run inside a click handler: Chrome requires user activation to start the download.
    await onDeviceModels().labeler.initializeDeviceModel((value) => {
      progress.value = value;
    });
    progress.hidden = true;
    log(`On-device model status: ${await getDeviceStatus()}`);
  }),
);

$('run-device').addEventListener('click', () =>
  withBusy('on-device-tests', async () => {
    const m = onDeviceModels();
    log('Running on-device tests (F3, F7, F9a)…');
    merge(await runLabelerTest(m, log));
    merge(await runExplainerTest(m, log));
    merge(await runGuardTest(m, log));
    log('On-device tests finished.');
  }),
);

$('run-cloud').addEventListener('click', () =>
  withBusy('cloud-tests', async () => {
    const { ai } = getFirebase();
    log('Running cloud tests…');
    merge(await runCloudPing(ai, log));
    // Fallback model first: the larger PRD models can hang for over a minute before a 500.
    log(`Checking cloud features on the fallback model (${FALLBACK_CLOUD_MODEL})…`);
    merge(await runReporterCheck(ai, log, FALLBACK_CLOUD_MODEL, 'I5'));
    merge(await runFunctionCallingCheck(ai, log, FALLBACK_CLOUD_MODEL, 'I6'));
    merge(await runSearchComboCheck(ai, log, FALLBACK_CLOUD_MODEL, 'I7'));
    log('Checking cloud features on the PRD models…');
    merge(await runReporterCheck(ai, log));
    merge(await runFunctionCallingCheck(ai, log));
    merge(await runSearchComboCheck(ai, log));
    merge(await runPreferOnDeviceCheck(ai, log));
    log('Cloud tests finished.');
  }),
);

$('run-speed').addEventListener('click', () =>
  withBusy('speed-comparison', async () => {
    log('Running speed comparison (6 variants × 40 transactions, a few minutes)…');
    merge(await runSpeedComparison(getFirebase().ai, log));
    log('Speed comparison finished.');
  }),
);

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    $('saved').textContent = 'Results JSON copied to the clipboard.';
  } catch {
    $('saved').textContent = 'Clipboard not available in this browser.';
  }
});

void renderEnvironment();
