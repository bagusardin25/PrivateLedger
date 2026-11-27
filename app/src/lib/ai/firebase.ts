import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider, type AppCheckOptions } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

// Every variable is read as `import.meta.env.NAME`, never through a copy of the
// whole object. Vite replaces each reference on its own, so a build only
// contains the values it actually uses.
const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

/** True when the build holds a real Firebase web config. */
export const hasRealConfig = Boolean(config.apiKey && config.projectId && config.appId);

export type AppCheckMode = 'recaptcha-enterprise' | 'recaptcha-v3' | 'debug-token' | 'none';

/**
 * App Check is enforced for Firebase AI Logic, so a cloud call only works with
 * one of these:
 * - production: reCAPTCHA Enterprise (recommended) or reCAPTCHA v3 site key;
 * - development: the debug token from .env.development.local.
 */
function detectAppCheckMode(): AppCheckMode {
  if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) return 'recaptcha-enterprise';
  if (import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY) return 'recaptcha-v3';
  if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) return 'debug-token';
  return 'none';
}

export const appCheckMode: AppCheckMode = detectAppCheckMode();

/** Cloud features (summary, advisor, consent fallback) are offered only when a request can pass App Check. */
export const cloudReady = hasRealConfig && appCheckMode !== 'none';

/**
 * AI Logic only checks that these fields are non-empty when a model is created.
 * On-device calls never reach Firebase, so placeholders keep on-device features
 * working in a checkout without a Firebase project. Cloud features stay off.
 */
const PLACEHOLDER_CONFIG: FirebaseOptions = {
  apiKey: 'placeholder-on-device-only',
  projectId: 'placeholder-on-device-only',
  appId: 'placeholder-on-device-only',
};

let cached: { app: FirebaseApp; ai: AI } | undefined;

export function getFirebase(): { app: FirebaseApp; ai: AI } {
  if (cached) return cached;
  const app = initializeApp(hasRealConfig ? config : PLACEHOLDER_CONFIG);
  if (cloudReady) initAppCheck(app);
  cached = { app, ai: getAI(app, { backend: new GoogleAIBackend() }) };
  return cached;
}

function appCheckProvider(): AppCheckOptions['provider'] {
  if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) return new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY);
  if (import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY) return new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY);
  // Debug-token mode: the SDK exchanges the debug token and never asks this provider.
  return new CustomProvider({ getToken: () => Promise.reject(new Error('No App Check provider configured for this build.')) });
}

function initAppCheck(app: FirebaseApp): void {
  // The whole block is removed from production builds, and the token lives in
  // .env.development.local, which `vite build` does not read.
  if (import.meta.env.DEV) {
    const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
    if (debugToken) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }
  initializeAppCheck(app, { provider: appCheckProvider(), isTokenAutoRefreshEnabled: true });
  watchRecaptchaScript();
}

// ---------------------------------------------------------------------------
// App Check has to survive a first AI call made offline.
//
// Sorting works offline, so the first AI call of a visit can easily happen
// without a connection. That call is also what sets up App Check, and the App
// Check SDK (checked in 13.2.0, `loadReCAPTCHAEnterpriseScript`) adds the
// reCAPTCHA script with an `onload` handler and nothing for a failed load. When
// the load fails, the SDK never finishes setting up, and every later cloud
// request waits for a token that cannot come, until the page is reloaded.
// So the app watches that script and loads it again once there is a connection.

const RECAPTCHA_SCRIPT = 'script[src^="https://www.google.com/recaptcha/"]';

/** The SDK's reCAPTCHA script, when its last load failed. */
let failedRecaptchaScript: HTMLScriptElement | undefined;

function rememberIfItFails(script: HTMLScriptElement): void {
  script.addEventListener(
    'error',
    () => {
      failedRecaptchaScript = script;
      // A load can also fail on a flaky connection that the browser calls online.
      if (navigator.onLine) setTimeout(recoverAppCheck, 3_000);
    },
    { once: true },
  );
}

function watchRecaptchaScript(): void {
  // The SDK adds the script synchronously, so it is in the page by now. In a
  // build that only uses the debug token there may be none, and that is fine.
  const script = document.head.querySelector<HTMLScriptElement>(RECAPTCHA_SCRIPT);
  if (script) rememberIfItFails(script);
  window.addEventListener('online', recoverAppCheck);
}

/**
 * Loads the reCAPTCHA script again if its last load failed. The new script
 * gets the SDK's own `onload` handler, so App Check carries on from where it
 * stopped. Does nothing when there is nothing to recover; safe to call often.
 */
export function recoverAppCheck(): void {
  const failed = failedRecaptchaScript;
  if (!failed || !navigator.onLine) return;
  failedRecaptchaScript = undefined;
  const script = document.createElement('script');
  script.src = failed.src;
  script.onload = failed.onload;
  rememberIfItFails(script);
  failed.replaceWith(script);
}
