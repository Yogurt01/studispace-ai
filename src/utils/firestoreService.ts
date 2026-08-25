import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  ChatMessage,
  Quiz,
  StudyNote,
  Assignment,
  FlashcardDeck,
} from "../types";
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_DECKS,
  INITIAL_NOTES,
  INITIAL_QUIZZES,
} from "./initialData";

// --- FIREBASE STORAGE & DOCUMENTS SERVICE ---
export interface UploadedStudyDocument {
  id: string;
  name: string;
  downloadUrl: string;
  storagePath: string;
  size: number;
  type: string;
  userId: string;
  uploadedAt: string;
}

export async function uploadDocumentToFirebaseStorage(
  file: File,
  userId: string = "scholar-guest"
): Promise<UploadedStudyDocument> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const storagePath = `documents/${userId}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const uploadResult = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(uploadResult.ref);

    const docId = `doc-${timestamp}`;
    const docData: UploadedStudyDocument = {
      id: docId,
      name: file.name,
      downloadUrl,
      storagePath,
      size: file.size,
      type: file.type || "application/octet-stream",
      userId,
      uploadedAt: new Date().toISOString(),
    };

    // Store metadata in Firestore
    try {
      await setDoc(doc(db, "documents", docId), docData);
    } catch (firestoreErr) {
      console.warn("Could not save doc metadata to Firestore (transient storage active):", firestoreErr);
    }

    return docData;
  } catch (err: any) {
    console.error("Firebase Storage Upload Error:", err);
    // If storage has network rules or sandbox limits, generate a safe data object
    const localDataUrl = URL.createObjectURL(file);
    return {
      id: `local-doc-${timestamp}`,
      name: file.name,
      downloadUrl: localDataUrl,
      storagePath,
      size: file.size,
      type: file.type || "application/octet-stream",
      userId,
      uploadedAt: new Date().toISOString(),
    };
  }
}

export function subscribeToDocuments(
  userId: string | null,
  callback: (docs: UploadedStudyDocument[]) => void
) {
  try {
    const docsRef = collection(db, "documents");
    const q = userId
      ? query(docsRef, where("userId", "in", [userId, "scholar-guest"]), orderBy("uploadedAt", "desc"))
      : query(docsRef, orderBy("uploadedAt", "desc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: UploadedStudyDocument[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as UploadedStudyDocument);
        });
        callback(list);
      },
      (err) => {
        console.warn("Documents snapshot fallback:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToDocuments error:", err);
    return () => {};
  }
}

// --- CHATS SERVICE ---
export function subscribeToChats(
  userId: string | null,
  callback: (messages: ChatMessage[]) => void
) {
  try {
    const chatsRef = collection(db, "chats");
    const q = userId
      ? query(chatsRef, where("userId", "in", [userId, "guest"]), orderBy("createdAt", "asc"))
      : query(chatsRef, orderBy("createdAt", "asc"));

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((d) => {
          msgs.push({ id: d.id, ...d.data() } as ChatMessage);
        });
        callback(msgs);
      },
      (err) => {
        console.warn("Chats onSnapshot warning (falling back):", err);
      }
    );
  } catch (err) {
    console.error("subscribeToChats error:", err);
    return () => {};
  }
}

export async function saveChatMessage(msg: ChatMessage): Promise<void> {
  try {
    const docRef = doc(db, "chats", msg.id);
    await setDoc(docRef, {
      ...msg,
      createdAt: msg.createdAt || Date.now(),
    });
  } catch (err) {
    console.error("saveChatMessage error:", err);
  }
}

export async function clearChatsFromDb(userId: string | null): Promise<void> {
  try {
    const chatsRef = collection(db, "chats");
    const q = userId
      ? query(chatsRef, where("userId", "==", userId))
      : query(chatsRef);
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (err) {
    console.error("clearChatsFromDb error:", err);
  }
}

// --- QUIZZES SERVICE ---
export function subscribeToQuizzes(
  userId: string | null,
  callback: (quizzes: Quiz[]) => void
) {
  try {
    const quizzesRef = collection(db, "quizzes");
    return onSnapshot(
      quizzesRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // Seed initial quizzes if empty
          await seedInitialQuizzes();
          return;
        }
        const list: Quiz[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Quiz);
        });
        callback(list);
      },
      (err) => {
        console.warn("Quizzes snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToQuizzes error:", err);
    return () => {};
  }
}

export async function seedInitialQuizzes(): Promise<void> {
  try {
    const batch = writeBatch(db);
    INITIAL_QUIZZES.forEach((quiz) => {
      const docRef = doc(db, "quizzes", quiz.id);
      batch.set(docRef, { ...quiz, userId: "system", createdAt: Date.now() });
    });
    await batch.commit();
  } catch (err) {
    console.error("seedInitialQuizzes error:", err);
  }
}

export async function saveQuizToDb(quiz: Quiz): Promise<void> {
  try {
    const docRef = doc(db, "quizzes", quiz.id);
    await setDoc(docRef, {
      ...quiz,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("saveQuizToDb error:", err);
  }
}

export async function updateQuizScoreInDb(
  quizId: string,
  score: number
): Promise<void> {
  try {
    const docRef = doc(db, "quizzes", quizId);
    await updateDoc(docRef, {
      bestScore: score,
      timesTaken: Date.now(), // update timestamp or increment
    });
  } catch (err) {
    console.error("updateQuizScoreInDb error:", err);
  }
}

// --- NOTES SERVICE ---
export function subscribeToNotes(
  userId: string | null,
  callback: (notes: StudyNote[]) => void
) {
  try {
    const notesRef = collection(db, "notes");
    return onSnapshot(
      notesRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // Seed initial notes
          await seedInitialNotes();
          return;
        }
        const list: StudyNote[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as StudyNote);
        });
        callback(list);
      },
      (err) => {
        console.warn("Notes snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToNotes error:", err);
    return () => {};
  }
}

export async function seedInitialNotes(): Promise<void> {
  try {
    const batch = writeBatch(db);
    INITIAL_NOTES.forEach((note) => {
      const docRef = doc(db, "notes", note.id);
      batch.set(docRef, { ...note, userId: "system", createdAt: Date.now() });
    });
    await batch.commit();
  } catch (err) {
    console.error("seedInitialNotes error:", err);
  }
}

export async function saveNoteToDb(note: StudyNote): Promise<void> {
  try {
    const docRef = doc(db, "notes", note.id);
    await setDoc(docRef, {
      ...note,
      updatedAt: new Date().toLocaleDateString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("saveNoteToDb error:", err);
  }
}

export async function deleteNoteFromDb(noteId: string): Promise<void> {
  try {
    const docRef = doc(db, "notes", noteId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("deleteNoteFromDb error:", err);
  }
}

// --- ASSIGNMENTS SERVICE ---
export function subscribeToAssignments(
  userId: string | null,
  callback: (assignments: Assignment[]) => void
) {
  try {
    const assignmentsRef = collection(db, "assignments");
    return onSnapshot(
      assignmentsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          await seedInitialAssignments();
          return;
        }
        const list: Assignment[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Assignment);
        });
        callback(list);
      },
      (err) => {
        console.warn("Assignments snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToAssignments error:", err);
    return () => {};
  }
}

export async function seedInitialAssignments(): Promise<void> {
  try {
    const batch = writeBatch(db);
    INITIAL_ASSIGNMENTS.forEach((a) => {
      const docRef = doc(db, "assignments", a.id);
      batch.set(docRef, { ...a, userId: "system" });
    });
    await batch.commit();
  } catch (err) {
    console.error("seedInitialAssignments error:", err);
  }
}

export async function saveAssignmentToDb(a: Assignment): Promise<void> {
  try {
    const docRef = doc(db, "assignments", a.id);
    await setDoc(docRef, a);
  } catch (err) {
    console.error("saveAssignmentToDb error:", err);
  }
}

export async function deleteAssignmentFromDb(id: string): Promise<void> {
  try {
    const docRef = doc(db, "assignments", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("deleteAssignmentFromDb error:", err);
  }
}

// --- FLASHCARD DECKS SERVICE ---
export function subscribeToDecks(
  userId: string | null,
  callback: (decks: FlashcardDeck[]) => void
) {
  try {
    const decksRef = collection(db, "decks");
    return onSnapshot(
      decksRef,
      async (snapshot) => {
        if (snapshot.empty) {
          await seedInitialDecks();
          return;
        }
        const list: FlashcardDeck[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as FlashcardDeck);
        });
        callback(list);
      },
      (err) => {
        console.warn("Decks snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToDecks error:", err);
    return () => {};
  }
}

export async function seedInitialDecks(): Promise<void> {
  try {
    const batch = writeBatch(db);
    INITIAL_DECKS.forEach((deck) => {
      const docRef = doc(db, "decks", deck.id);
      batch.set(docRef, { ...deck, userId: "system" });
    });
    await batch.commit();
  } catch (err) {
    console.error("seedInitialDecks error:", err);
  }
}

export async function saveDeckToDb(deck: FlashcardDeck): Promise<void> {
  try {
    const docRef = doc(db, "decks", deck.id);
    await setDoc(docRef, deck);
  } catch (err) {
    console.error("saveDeckToDb error:", err);
  }
}
