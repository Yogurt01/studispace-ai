/**
 * Resolution of the Firebase web configuration, kept separate from firebase.ts
 * so it can be unit tested without Vite's import.meta.env or a browser — the
 * same reason authErrors.ts is separate from LoginView.
 */

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

/**
 * The four values without which nothing can reach a Firebase project.
 * storageBucket and messagingSenderId are deliberately absent: a project with no
 * Cloud Storage bucket should still sign students in.
 */
const REQUIRED_CONFIG_KEYS = ["apiKey", "authDomain", "projectId", "appId"] as const;

/**
 * Stands in for an absent API key.
 *
 * getAuth() throws auth/invalid-api-key *synchronously* when apiKey is blank or
 * absent — not on the first sign-in attempt, but the moment firebase.ts is
 * evaluated. An unconfigured checkout therefore took the whole app down at
 * import time: no login screen, no error message, and no Guest Scholar mode,
 * which needs no Firebase project at all.
 *
 * A non-empty apiKey is the only thing getAuth requires in order to construct;
 * a *wrong* key is accepted and fails later at the network call. So when the key
 * is missing entirely, the SDK gets this placeholder, auth builds,
 * onAuthStateChanged reports "signed out", and the app's loading gate clears —
 * which is what lets the login screen render and explain the problem.
 *
 * It is never mistaken for a working setup: the returned error is non-null,
 * LoginView displays it, and AuthContext refuses to start a sign-in rather than
 * sending a fake key to Google.
 */
export const PLACEHOLDER_API_KEY = "studispace-missing-api-key";

export interface ResolvedFirebaseConfig {
  config: FirebaseWebConfig;
  /** Non-null when the project is not usable; shown on the login screen. */
  error: string | null;
}

export function resolveFirebaseConfig(raw: FirebaseWebConfig): ResolvedFirebaseConfig {
  const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => !raw[key]);

  if (missingKeys.length === 0) {
    return { config: raw, error: null };
  }

  const error =
    `Firebase client configuration is incomplete. Missing: ${missingKeys
      .map((key) => `VITE_FIREBASE_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
      .join(", ")}. Copy .env.example to .env and fill in the values from ` +
    `Firebase Console → Project settings → Your apps. ` +
    `Guest Scholar mode works without any of this; signing in does not.`;

  return {
    // Only the missing key is substituted. A wrong-but-present key is left alone
    // so it reaches Firebase and fails with a specific error of its own.
    config: { ...raw, apiKey: raw.apiKey || PLACEHOLDER_API_KEY },
    error,
  };
}
