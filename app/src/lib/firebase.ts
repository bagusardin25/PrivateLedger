import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

const env = import.meta.env;

/** True when .env.local holds a real Firebase web config. Cloud features need it. */
export const hasRealConfig = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);

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
  const app = hasRealConfig
    ? initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        appId: env.VITE_FIREBASE_APP_ID,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      })
    : initializeApp(PLACEHOLDER_CONFIG);
  if (hasRealConfig) initAppCheck(app);
  cached = { app, ai: getAI(app, { backend: new GoogleAIBackend() }) };
  return cached;
}

/**
 * App Check is enforced for Firebase AI Logic.
 * - Local development: the debug token from .env.local.
 * - Production: reCAPTCHA Enterprise, when a site key is configured.
 * Without either, cloud calls fail with an App Check error and the UI says so.
 */
function initAppCheck(app: FirebaseApp): void {
  if (env.DEV && env.VITE_APPCHECK_DEBUG_TOKEN) {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN;
  }
  const provider = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
    ? new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY)
    : new CustomProvider({ getToken: () => Promise.reject(new Error('No App Check provider configured for this build.')) });
  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
}
