import { initializeApp, SDK_VERSION, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, type AI } from 'firebase/ai';

const env = import.meta.env;

/** True when .env.local holds a real Firebase web config. Cloud tests need it. */
export const hasRealConfig = Boolean(
  env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID,
);
export const hasDebugToken = Boolean(env.VITE_APPCHECK_DEBUG_TOKEN);
export const firebaseSdkVersion = SDK_VERSION;

/**
 * Firebase AI Logic only checks that these fields are non-empty when a model is
 * created. On-device calls never reach Firebase, so placeholders let the
 * on-device tests run before a Firebase project exists. Cloud tests stay
 * disabled in this mode.
 */
const PLACEHOLDER_CONFIG: FirebaseOptions = {
  apiKey: 'placeholder-on-device-only',
  projectId: 'placeholder-on-device-only',
  appId: 'placeholder-on-device-only',
};

let cached: { app: FirebaseApp; ai: AI } | undefined;

export function getFirebase(): { app: FirebaseApp; ai: AI } {
  if (cached) return cached;

  let app: FirebaseApp;
  if (hasRealConfig) {
    app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    });
    initAppCheck(app);
  } else {
    app = initializeApp(PLACEHOLDER_CONFIG);
  }

  cached = { app, ai: getAI(app, { backend: new GoogleAIBackend() }) };
  return cached;
}

/**
 * App Check is enforced for Firebase AI Logic. Local runs use a debug token
 * registered in the Firebase console. Without a reCAPTCHA Enterprise site key,
 * a CustomProvider stands in so no reCAPTCHA script is loaded; debug mode never
 * asks it for a token.
 */
function initAppCheck(app: FirebaseApp): void {
  const globals = self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean };
  globals.FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || true;

  const provider = env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
    ? new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY)
    : new CustomProvider({
        getToken: () => Promise.reject(new Error('Only the App Check debug token is used in this test.')),
      });

  initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
}
