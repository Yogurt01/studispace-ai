import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Read Firebase client configuration from environment variables.
// These values must match the Firebase web app that the app uses.
const runtimeConfig = (globalThis as typeof globalThis & { __STUDISPACE_RUNTIME_CONFIG__?: Record<string, string> }).__STUDISPACE_RUNTIME_CONFIG__ ?? {};
const firebaseConfig = {
  apiKey: runtimeConfig.VITE_FIREBASE_API_KEY ?? import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: runtimeConfig.VITE_FIREBASE_AUTH_DOMAIN ?? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: runtimeConfig.VITE_FIREBASE_PROJECT_ID ?? import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: runtimeConfig.VITE_FIREBASE_STORAGE_BUCKET ?? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: runtimeConfig.VITE_FIREBASE_MESSAGING_SENDER_ID ?? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: runtimeConfig.VITE_FIREBASE_APP_ID ?? import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn("Firebase environment variables are missing. Populate .env with your Firebase web config before running the app.");
}

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Storage
export const storage = getStorage(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
