import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Read Firebase config from environment variables with fallback to provisioned settings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAZjfdRtWNKZdV5lSq4Uon-VuAbimJiss8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "n8n-hragent.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "n8n-hragent",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "n8n-hragent.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "661978143452",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:661978143452:web:4206486b047d3f2537f219",
};

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
