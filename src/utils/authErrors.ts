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
};

export function describeAuthError(err: { code?: string; message?: string } | null | undefined): string {
  const mapped = err?.code ? AUTH_ERROR_MESSAGES[err.code] : undefined;
  return mapped || err?.message || "Authentication error occurred.";
}
