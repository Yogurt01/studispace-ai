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
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  ChatMessage,
  Quiz,
  StudyNote,
  Assignment,
  FlashcardDeck,
  CourseGrade,
  StudyDocument,
} from "../types";
import {
  GUEST_USER_ID,
  INITIAL_ASSIGNMENTS,
  INITIAL_DECKS,
  INITIAL_NOTES,
  INITIAL_QUIZZES,
  INITIAL_COURSES,
  INITIAL_STUDY_DOCUMENTS,
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

export async function uploadStudyDocument(
  userId: string,
  file: File,
  metadata?: Partial<StudyDocument>
): Promise<StudyDocument> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const storagePath = `users/${userId}/documents/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  let downloadUrl = "";
  let finalStoragePath: string | undefined = storagePath;

  try {
    const uploadResult = await uploadBytes(storageRef, file);
    downloadUrl = await getDownloadURL(uploadResult.ref);
  } catch (err) {
    console.warn("Firebase Storage direct upload failed/fallback to blob URL:", err);
    downloadUrl = URL.createObjectURL(file);
    finalStoragePath = undefined;
  }

  const docId = `doc-${timestamp}`;
  const newDoc: StudyDocument = {
    id: docId,
    userId: userId || GUEST_USER_ID,
    title: metadata?.title?.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
    fileName: file.name,
    fileUrl: downloadUrl,
    storagePath: finalStoragePath,
    fileType: file.type || "application/pdf",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    courseTag: metadata?.courseTag || "General",
    category: metadata?.category || "Lecture Slide",
    pinned: metadata?.pinned ?? false,
  };

  // If user is logged in, save to Firestore
  if (userId && userId !== GUEST_USER_ID) {
    try {
      await setDoc(doc(db, "documents", docId), newDoc);
    } catch (firestoreErr) {
      console.warn("Could not save document metadata to Firestore:", firestoreErr);
    }
  } else {
    // Save to guest localStorage
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      const currentList: StudyDocument[] = saved ? JSON.parse(saved) : INITIAL_STUDY_DOCUMENTS;
      localStorage.setItem("studispace_guest_documents", JSON.stringify([newDoc, ...currentList]));
    } catch (localErr) {
      console.warn("Guest storage write failed:", localErr);
    }
  }

  return newDoc;
}

export async function fetchStudyDocuments(userId: string): Promise<StudyDocument[]> {
  if (!userId || userId === GUEST_USER_ID) {
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to read guest documents from storage", e);
    }
    return INITIAL_STUDY_DOCUMENTS;
  }

  try {
    const docsRef = collection(db, "documents");
    const q = query(docsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const list: StudyDocument[] = [];
    snapshot.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as StudyDocument);
    });
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.uploadedAt || "").localeCompare(a.uploadedAt || "");
    });
    return list.length > 0 ? list : INITIAL_STUDY_DOCUMENTS;
  } catch (err) {
    console.error("fetchStudyDocuments error:", err);
    return INITIAL_STUDY_DOCUMENTS;
  }
}

export function subscribeToStudyDocuments(
  userId: string | null,
  callback: (docs: StudyDocument[]) => void
) {
  if (!userId || userId === GUEST_USER_ID) {
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      const list = saved ? JSON.parse(saved) : INITIAL_STUDY_DOCUMENTS;
      callback(list);
    } catch {
      callback(INITIAL_STUDY_DOCUMENTS);
    }
    return () => {};
  }

  try {
    const docsRef = collection(db, "documents");
    const q = query(docsRef, where("userId", "==", userId));

    return onSnapshot(
      q,
      (snapshot) => {
        const list: StudyDocument[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as StudyDocument);
        });
        list.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return (b.uploadedAt || "").localeCompare(a.uploadedAt || "");
        });
        callback(list.length > 0 ? list : INITIAL_STUDY_DOCUMENTS);
      },
      (err) => {
        console.warn("StudyDocuments onSnapshot fallback:", err);
        callback(INITIAL_STUDY_DOCUMENTS);
      }
    );
  } catch (err) {
    console.error("subscribeToStudyDocuments error:", err);
    callback(INITIAL_STUDY_DOCUMENTS);
    return () => {};
  }
}

export async function deleteStudyDocument(
  userId: string,
  documentId: string,
  storagePath?: string
): Promise<void> {
  if (storagePath) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      console.warn("Firebase Storage file delete error:", err);
    }
  }

  if (userId && userId !== GUEST_USER_ID) {
    try {
      await deleteDoc(doc(db, "documents", documentId));
    } catch (err) {
      console.error("deleteStudyDocument Firestore error:", err);
    }
  } else {
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      if (saved) {
        const currentList: StudyDocument[] = JSON.parse(saved);
        const filtered = currentList.filter((d) => d.id !== documentId);
        localStorage.setItem("studispace_guest_documents", JSON.stringify(filtered));
      }
    } catch (err) {
      console.warn("Guest document deletion failed:", err);
    }
  }
}

export async function togglePinDocument(
  userId: string,
  documentId: string,
  pinned: boolean
): Promise<void> {
  if (userId && userId !== GUEST_USER_ID) {
    try {
      await updateDoc(doc(db, "documents", documentId), { pinned });
    } catch (err) {
      console.error("togglePinDocument error:", err);
    }
  } else {
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      const currentList: StudyDocument[] = saved ? JSON.parse(saved) : INITIAL_STUDY_DOCUMENTS;
      const updated = currentList.map((d) => (d.id === documentId ? { ...d, pinned } : d));
      localStorage.setItem("studispace_guest_documents", JSON.stringify(updated));
    } catch (err) {
      console.warn("Guest toggle pin failed:", err);
    }
  }
}

export async function saveStudyDocumentToDb(docData: StudyDocument): Promise<void> {
  if (docData.userId && docData.userId !== GUEST_USER_ID) {
    try {
      await setDoc(doc(db, "documents", docData.id), docData);
    } catch (err) {
      console.error("saveStudyDocumentToDb error:", err);
    }
  }
}

export function subscribeToDocuments(
  userId: string | null,
  callback: (docs: UploadedStudyDocument[]) => void
) {
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

