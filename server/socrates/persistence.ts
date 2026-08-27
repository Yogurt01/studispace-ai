import { getAdminFirestore } from "../firebaseAdmin";
import { ConversationRepository, ConversationState } from "./types";

export class FirestoreConversationRepository implements ConversationRepository {
  private db = (() => {
    const db = getAdminFirestore();
    if (!db) throw new Error("FIREBASE_ADMIN_UNAVAILABLE");
    return db;
  })();
  async load(threadId: string, userId: string) {
    const doc = await this.db.collection("chats").doc(threadId).get();
    if (!doc.exists) return null;
    const state = doc.data() as ConversationState;
    if (state.userId !== userId) throw new Error("CONVERSATION_FORBIDDEN");
    return state;
  }
  async save(state: ConversationState) { await this.db.collection("chats").doc(state.threadId).set(state); }
}

/** Enables local development without credentials; production uses Firestore above. */
export class InMemoryConversationRepository implements ConversationRepository {
  private states = new Map<string, ConversationState>();
  async load(threadId: string, userId: string) { const state = this.states.get(threadId) || null; if (state && state.userId !== userId) throw new Error("CONVERSATION_FORBIDDEN"); return state; }
  async save(state: ConversationState) { this.states.set(state.threadId, structuredClone(state)); }
}
