import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
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
  CourseGrade,
} from "../types";
import {
  GUEST_USER_ID,
  INITIAL_ASSIGNMENTS,
  INITIAL_DECKS,
  INITIAL_NOTES,
  INITIAL_QUIZZES,
  INITIAL_COURSES,
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
  // Documents are private to their uploader, so the query must be scoped to a
  // single userId: security rules reject any query that could match another
  // student's documents. Ordering is applied client-side because an equality
  // filter combined with orderBy would require a deployed composite index.
  // Guest Scholars have no Firebase Auth user, so they are treated as signed out.
  if (!userId || userId === GUEST_USER_ID) {
    callback([]);
    return () => {};
  }

  try {
    const docsRef = collection(db, "documents");
    const q = query(docsRef, where("userId", "==", userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: UploadedStudyDocument[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as UploadedStudyDocument);
        });
        list.sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || ""));
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
  // Chats are private to their owner, so the query must be scoped to a single
  // userId: security rules reject any query that could match another student's
  // messages. Ordering is applied client-side because an equality filter
  // combined with orderBy would require a deployed composite index.
  // Guest Scholars have no Firebase Auth user, so they are treated as signed out.
  if (!userId || userId === GUEST_USER_ID) {
    callback([]);
    return () => {};
  }

  try {
    const chatsRef = collection(db, "chats");
    const q = query(chatsRef, where("userId", "==", userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((d) => {
          // The server persists LangGraph conversation state in this collection
          // keyed by threadId; those documents carry no `role` and are not messages.
          if (!d.data().role) return;
          msgs.push({ id: d.id, ...d.data() } as ChatMessage);
        });
        msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
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
  // Security rules require an authenticated caller. Subscribing while signed out
  // (or as a Guest Scholar, who has no Firebase Auth user) guarantees a
  // permission-denied snapshot error, so stay off the wire instead.
  if (!userId || userId === GUEST_USER_ID) {
    return () => {};
  }

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
  // Security rules require an authenticated caller. Subscribing while signed out
  // (or as a Guest Scholar, who has no Firebase Auth user) guarantees a
  // permission-denied snapshot error, so stay off the wire instead.
  if (!userId || userId === GUEST_USER_ID) {
    return () => {};
  }

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
  // Security rules require an authenticated caller. Subscribing while signed out
  // (or as a Guest Scholar, who has no Firebase Auth user) guarantees a
  // permission-denied snapshot error, so stay off the wire instead.
  if (!userId || userId === GUEST_USER_ID) {
    return () => {};
  }

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
  // Security rules require an authenticated caller. Subscribing while signed out
  // (or as a Guest Scholar, who has no Firebase Auth user) guarantees a
  // permission-denied snapshot error, so stay off the wire instead.
  if (!userId || userId === GUEST_USER_ID) {
    return () => {};
  }

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

// --- COURSES & GPA SERVICE ---
export function subscribeToCourses(
  userId: string | null,
  callback: (courses: CourseGrade[]) => void
) {
  // Security rules require an authenticated caller. Subscribing while signed out
  // (or as a Guest Scholar, who has no Firebase Auth user) guarantees a
  // permission-denied snapshot error, so stay off the wire instead.
  if (!userId || userId === GUEST_USER_ID) {
    return () => {};
  }

  try {
    const coursesRef = collection(db, "courses");
    return onSnapshot(
      coursesRef,
      async (snapshot) => {
        if (snapshot.empty) {
          await seedInitialCourses();
          return;
        }
        const list: CourseGrade[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as CourseGrade);
        });
        callback(list);
      },
      (err) => {
        console.warn("Courses snapshot error:", err);
      }
    );
  } catch (err) {
    console.error("subscribeToCourses error:", err);
    return () => {};
  }
}

export async function seedInitialCourses(): Promise<void> {
  try {
    const batch = writeBatch(db);
    INITIAL_COURSES.forEach((course) => {
      const docRef = doc(db, "courses", course.id);
      batch.set(docRef, { ...course, userId: "system" });
    });
    await batch.commit();
  } catch (err) {
    console.error("seedInitialCourses error:", err);
  }
}

export async function saveCourseToDb(course: CourseGrade): Promise<void> {
  try {
    const docRef = doc(db, "courses", course.id);
    await setDoc(docRef, course);
  } catch (err) {
    console.error("saveCourseToDb error:", err);
  }
}

export async function saveBatchCoursesToDb(courses: CourseGrade[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    courses.forEach((c) => {
      const docRef = doc(db, "courses", c.id);
      batch.set(docRef, c);
    });
    await batch.commit();
  } catch (err) {
    console.error("saveBatchCoursesToDb error:", err);
  }
}

export async function deleteCourseFromDb(id: string): Promise<void> {
  try {
    const docRef = doc(db, "courses", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("deleteCourseFromDb error:", err);
  }
}

