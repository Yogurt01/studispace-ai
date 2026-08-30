import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { FirebaseWebConfig, resolveFirebaseConfig } from "./firebaseConfig";

// Firebase web config is public by design, but it must be *complete* and it must
// point at the same project the Authorized Domains are configured on. It arrives
// either from the server (/runtime-config.js, used by the built container image)
// or from Vite's build-time env. Never put service-account credentials here.
const runtimeConfig =
  (globalThis as typeof globalThis & { __STUDISPACE_RUNTIME_CONFIG__?: Record<string, string> })
    .__STUDISPACE_RUNTIME_CONFIG__ ?? {};

function readConfigValue(key: string): string {
  const buildEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
  const value = runtimeConfig[key] ?? buildEnv[key];
  return typeof value === "string" ? value.trim() : "";
}

export type { FirebaseWebConfig } from "./firebaseConfig";

// Values as requested by the environment, before any placeholder is applied.
const requestedConfig: FirebaseWebConfig = {
  apiKey: readConfigValue("VITE_FIREBASE_API_KEY"),
  authDomain: readConfigValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readConfigValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readConfigValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readConfigValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readConfigValue("VITE_FIREBASE_APP_ID"),
};

const resolved = resolveFirebaseConfig(requestedConfig);
const firebaseConfig = resolved.config;

export const firebaseConfigError: string | null = resolved.error;

/** True when this build can actually talk to a Firebase project. */
export const isFirebaseConfigured = firebaseConfigError === null;

if (firebaseConfigError) {
  console.error(firebaseConfigError);
}

// authDomain drives the OAuth handler origin. If it names a different project
// than projectId, popups redirect to the wrong project and sign-in fails in ways
// that look like a domain problem, so surface the mismatch up front.
if (
  isFirebaseConfigured &&
  firebaseConfig.authDomain.endsWith(".firebaseapp.com") &&
  firebaseConfig.authDomain.split(".")[0] !== firebaseConfig.projectId
) {
  console.warn(
    `Firebase config mismatch: VITE_FIREBASE_AUTH_DOMAIN ("${firebaseConfig.authDomain}") does not belong to ` +
      `VITE_FIREBASE_PROJECT_ID ("${firebaseConfig.projectId}"). Google sign-in will fail until these agree.`
  );
}

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore.
//
// ignoreUndefinedProperties is what stops an optional field that happens to be
// undefined from failing the whole write. Without it setDoc() rejects the
// document outright ("Unsupported field value: undefined"), which in practice
// means one absent optional field discards every other field with it. Omitting
// the key is the behaviour the callers already assume.
//
// initializeFirestore throws if Firestore has already been started for this app,
// which happens when Vite re-evaluates this module during HMR. Fall back to the
// instance that is already running rather than taking the app down with it.
function createFirestore() {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
}

export const db = createFirestore();

// Initialize Storage
export const storage = getStorage(app);

// Initialize Auth. Safe against a missing apiKey because resolveFirebaseConfig
// substituted a placeholder for it; see the comment there for why that matters.
export const auth = getAuth(app);

// Keep the session across reloads and new tabs. This is the SDK default for the
// browser, but setting it explicitly means a refresh cannot silently drop the
// student's session if the default ever changes. There is no session to persist
// when the project is unconfigured, so skip it rather than log a second error
// that only restates firebaseConfigError.
if (isFirebaseConfigured) {
  void setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Could not enable persistent auth sessions:", err);
  });
}

export const googleProvider = new GoogleAuthProvider();
// Always let the student pick an account rather than silently reusing the one
// Chrome happens to be signed into.
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Firebase matches `window.location.hostname` (never the port) against the
 * project's Authorized Domains. Opening the dev server on a LAN IP or a tunnel
 * host therefore fails with auth/unauthorized-domain even though the identical
 * build works on localhost. Warn at startup so this is obvious before a student
 * clicks "Continue with Google".
 */
export function isLikelyAuthorizedHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (hostname.endsWith(".localhost")) return true;
  const authDomainHost = firebaseConfig.authDomain;
  if (hostname === authDomainHost || hostname.endsWith(`.${authDomainHost}`)) return true;
  if (firebaseConfig.projectId) {
    const hosted = [`${firebaseConfig.projectId}.web.app`, `${firebaseConfig.projectId}.firebaseapp.com`];
    if (hosted.some((h) => hostname === h || hostname.endsWith(`.${h}`))) return true;
  }
  return false;
}

if (
  isFirebaseConfigured &&
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  !isLikelyAuthorizedHost(window.location.hostname)
) {
  console.warn(
    `StudiSpace is running on "${window.location.hostname}", which is probably not in this Firebase project's ` +
      `Authorized Domains. Google sign-in will fail with auth/unauthorized-domain. ` +
      `Open http://localhost:${window.location.port || "3000"} instead, or add this hostname under ` +
      `Firebase Console → Authentication → Settings → Authorized domains.`
  );
}

export default app;
