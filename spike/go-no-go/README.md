# Go/no-go tests for Private Ledger

A test page that checked the technical assumptions behind Private Ledger **before** the app was built. All data here is synthetic.

| ID | What it checks | Needs |
|---|---|---|
| G1 | The on-device model answers through Firebase AI Logic | Chrome with the model |
| G2 | Labeling: JSON is always valid (2 batches of 20 transactions) | Chrome with the model |
| G3 | Labeling: under 15 seconds per batch | Chrome with the model |
| G4 | Labeling: business/personal accuracy of at least 80% | Chrome with the model |
| G5 | Merchant explanation: the model does not make up merchants | Chrome with the model |
| G6 | Message guard: blocks transaction data | Chrome with the model (the rule layer runs without it) |
| G7 | Three cloud models answer on the free tier | A Firebase project |
| I1–I4 | Cloud structured output, function calling, function calling with Google Search, `inferenceSource` | A Firebase project |
| I5–I7 | I1–I3 again on `gemini-3.5-flash-lite`, run first. Added on 26 Nov after the larger models kept failing under load | A Firebase project |

The pass thresholds can be changed in `src/tests.ts` (`THRESHOLDS`).

## Results

Run on 21 Nov 2026 (on-device: Chrome 158, RTX 4050 6 GB, Firebase JS SDK 13.2.0) and 26 Nov 2026 (cloud, Spark plan). These results decided how the app works.

| ID | Result | What changed in the app |
|---|---|---|
| G1 | Passed | |
| G2 | Passed: 2 of 2 batches valid | |
| G3 | Failed: 27.5 to 36.1 s per 20 rows; fastest variant 15.3 s. With streaming in batches of 10, the first row appeared after 2.0 s | Streaming batches of 10, and each unique merchant is labeled only once |
| G4 | Passed: 91% (30 of 33). But 0 of 7 ambiguous rows were marked "unsure", and a savings transfer, a payment-app transfer, and a warehouse club were labeled business with high confidence | Rules and a mixed-use merchant list run before the model and decide the review queue |
| G5 | Passed: 0 of 5 made-up merchants claimed as known; 4 of 4 real ones recognized | The answer carries a `known` field, and the app shows "not recognized" instead of a guess |
| G6 | Passed: 8 of 8 caught, no false block. The model layer missed one message that only the rules caught | Rules always run; the rules were retested with new messages (`app/scripts/g9.ts`) |
| G7 | Only `gemini-3.5-flash-lite` answered reliably (2 to 7 s). `gemini-3.8-flash` and `gemini-4-hydrogen` returned 500 or 503, or hung for about 3 minutes | `gemini-3.5-flash-lite` for every cloud feature, and a 20 s timeout on every cloud request |
| I3, I7 | Function calling with Google Search was always rejected with 429 (quota) | Search grounding was dropped |
| I4 | `in_cloud` reported correctly when no on-device model exists | |
| I5 | Structured output valid in 3.4 s; the payload held only totals | Used for the monthly summary |
| I6 | The model called the local function and answered with the right total | Used for the advisor |

## Step 1: turn on the on-device model in Chrome

1. Open `chrome://flags`, search for **Gemma 4 for Built-in AI**, set it to **Enabled**, and click **Relaunch**.
2. If the page still says "LanguageModel API missing", also enable **Prompt API for Gemini Nano** in `chrome://flags`.
3. The model download status is shown at `chrome://on-device-internals`.

Device requirements from the Chrome documentation: a GPU with more than 4 GB of VRAM, and at least 22 GB of free space on the drive that holds the Chrome profile.

## Step 2: run the on-device tests (no Firebase project needed)

```bash
npm install
npm run dev
```

1. Open **http://localhost:5173** in regular Chrome.
2. Click **1. Enable on-device AI**. The download can take several minutes; progress is shown on the page.
3. Click **2. Run on-device tests**.

Without `.env.local`, the page uses a placeholder Firebase config. That is safe, because on-device calls never contact Firebase, and the cloud test button is disabled.

## Step 3: set up a Firebase project (for the cloud tests)

1. Open the [Firebase console](https://console.firebase.google.com/) and create a project. Google Analytics is not needed.
2. Go to **AI Services → AI Logic → Get started**, choose the **Gemini Developer API** (no billing needed), and follow the steps. This also turns on App Check for AI Logic.
3. Go to **Project settings → General → Your apps → Add app → Web**. Register the app (Hosting is not needed) and copy the `firebaseConfig` values.
4. Go to **Security → App Check → Apps**. On the web app, open the ⋮ menu → **Manage debug tokens** → **Add debug token** → **Generate**, and copy the value.
5. Copy `.env.example` to `.env.local` in this folder and fill in the values from steps 3 and 4.
6. Stop the server (Ctrl+C) and start it again; Vite only reads `.env.local` at startup.
7. Click **3. Run cloud tests**.

`.env.local` is in `.gitignore`. Never commit a debug token.

## Output

Each run saves a report to `results/latest.json`, plus a dated copy. The `results/` folder is not committed.

## SDK finding

In Firebase JS SDK 13.2.0 and 13.4.0 (`callCloudOrDevice`), when the browser has no `LanguageModel` API (for example Firefox, Safari, or Chrome without the flag), a request is **sent to the cloud model even if its mode is `ONLY_ON_DEVICE`**. Every on-device call here therefore goes through `assertOnDeviceReady()` (`src/onDevice.ts`), which refuses the request when the model is not available. The Private Ledger app uses the same guard.
