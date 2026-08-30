/**
 * Maps Firebase Auth error codes to the wording students see on the login screen.
 * Kept separate from LoginView so the mapping can be unit tested without a browser.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Invalid email or password. Check your credentials or sign up.",
  "auth/wrong-password": "Invalid email or password. Check your credentials or sign up.",
  "auth/user-not-found": "No account exists for that email. Create an account to get started.",
  "auth/invalid-email": "That email address doesn't look right. Check it and try again.",
  "auth/email-already-in-use": "This email is already registered. Try signing in instead.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment before trying again.",
  "auth/network-request-failed": "Network unavailable. Check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in popup closed before completing. Try again.",
  "auth/cancelled-popup-request": "Another sign-in is already in progress.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups for this site, then try again.",
  // Firebase compares window.location.hostname against the project's Authorized
  // Domains. The port is irrelevant, the hostname is not: opening the dev server
  // on a LAN IP or a tunnel host trips this even though localhost works.
  "auth/unauthorized-domain":
    "This address isn't authorized for sign-in. Open the app at http://localhost:3000, or add this domain under Firebase Console → Authentication → Settings → Authorized domains.",
  "auth/operation-not-allowed": "That sign-in method is disabled for this project. Enable it in the Firebase Console.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/missing-password": "Please enter your password.",
  "auth/invalid-api-key": "The Firebase API key is invalid. Check VITE_FIREBASE_API_KEY.",
  // Identity Toolkit rejects a well-formed but wrong key with this newer code.
  "auth/api-key-not-valid": "The Firebase API key is invalid. Check VITE_FIREBASE_API_KEY.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a different sign-in method. Try that method instead.",
};

export function describeAuthError(err: { code?: string; message?: string } | null | undefined): string {
  const mapped = err?.code ? AUTH_ERROR_MESSAGES[err.code] : undefined;
  return mapped || err?.message || "Authentication error occurred.";
}
