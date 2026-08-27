import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "../firebaseAdmin";

export type TokenVerifier = (idToken: string) => Promise<{ uid: string }>;

const verifyWithFirebase: TokenVerifier = async (idToken) => {
  if (!getAdminApp()) throw new Error("AUTH_UNAVAILABLE");
  return getAuth().verifyIdToken(idToken);
};

/** Guest threads are namespaced so they can never collide with a real Firebase uid. */
export function guestConversationUserId(threadId: string) { return `guest:${threadId}`; }

/**
 * Resolves who is making a conversation request.
 *
 * Identity comes from a verified Firebase ID token, never from the request body:
 * a client-supplied userId would let any caller read another student's thread.
 * Callers without a token stay usable (Guest Scholar mode) but are scoped to
 * their own thread.
 */
export async function resolveConversationUserId(
  authorizationHeader: string | undefined,
  threadId: string,
  verifyToken: TokenVerifier = verifyWithFirebase
): Promise<string> {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";
  if (!token) return guestConversationUserId(threadId);
  const decoded = await verifyToken(token);
  return decoded.uid;
}
