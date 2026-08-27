import { App, applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { Firestore, getFirestore } from "firebase-admin/firestore";

let firestore: Firestore | null | undefined;

/** Shared Firebase Admin app; null when server credentials are unavailable. */
export function getAdminApp(): App | null {
  const existing = getApps();
  if (existing.length) return existing[0];
  try {
    return initializeApp({ credential: applicationDefault() });
  } catch {
    return null;
  }
}

/** Shared Firestore handle, initialized exactly once. Null without credentials. */
export function getAdminFirestore(): Firestore | null {
  if (firestore !== undefined) return firestore;
  const app = getAdminApp();
  if (!app) return (firestore = null);
  const db = getFirestore(app);
  // Optional conversation fields (context, mode) are absent on many turns;
  // Firestore rejects undefined without this.
  db.settings({ ignoreUndefinedProperties: true });
  return (firestore = db);
}
