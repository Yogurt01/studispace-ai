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
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
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

/**
 * A stall that never moved a single byte is a different problem from one that
 * stopped halfway, and the difference is worth telling the student.
 *
 * Nothing at all transferred means the upload session could not even be opened.
 * By far the most common reason is that Cloud Storage has never been enabled for
 * the Firebase project, so the bucket in VITE_FIREBASE_STORAGE_BUCKET does not
 * exist: the browser gets no response to preflight and reports no status, which
 * looks exactly like a dead connection but is not one.
 */
/**
 * Raised when the Storage bucket itself appears not to exist.
 *
 * Distinct from an ordinary upload failure because the remedy is different and
 * the whole app should not keep pretending cloud uploads are available: nothing
 * transfers, no HTTP status ever comes back, and the fix is provisioning rather
 * than retrying. The UI keys its banner off this type.
 */
export class StorageUnavailableError extends Error {
  readonly storageUnavailable = true;

  constructor(message: string) {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export function isStorageUnavailable(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as any).storageUnavailable === true);
}

/**
 * Once the bucket has failed to answer, it will not start answering three
 * seconds later. Remembering that turns every later upload in the session into
 * an immediate, honest refusal instead of another 45-second wait.
 */
let storageLooksUnavailable = false;

/** Exposed so the Vault can show its banner before a student tries again. */
export function storageKnownUnavailable(): boolean {
  return storageLooksUnavailable;
}

/** Cleared when an upload does succeed, so a transient outage is not remembered forever. */
function markStorageReachable(): void {
  storageLooksUnavailable = false;
}

const STORAGE_UNPROVISIONED_MESSAGE =
  "Cloud Storage is not enabled for this Firebase project, so files cannot be stored. " +
  "Enable Storage in the Firebase Console and confirm VITE_FIREBASE_STORAGE_BUCKET names an " +
  "existing bucket. Everything else in your workspace keeps working.";

function describeStall(fileName: string, movedAnyBytes: boolean): Error {
  const seconds = Math.round(UPLOAD_STALL_TIMEOUT_MS / 1000);

  if (movedAnyBytes) {
    return new Error(
      `The upload of "${fileName}" stopped part way through and did not resume within ${seconds}s. Check your connection and try again.`
    );
  }

  storageLooksUnavailable = true;
  return new StorageUnavailableError(
    `"${fileName}" could not start uploading: the storage service did not respond within ${seconds}s. ` +
      STORAGE_UNPROVISIONED_MESSAGE
  );
}

/** Rejects if `promise` has not settled in time, so a hung call cannot wait forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * A transfer that has stopped moving bytes for this long is not slow, it is
 * stuck. A total time limit would be wrong — a large textbook on a slow
 * connection is legitimate and can take minutes — so the guard is on progress,
 * not on duration.
 */
const UPLOAD_STALL_TIMEOUT_MS = 45_000;

/**
 * Firestore queues writes while it believes it is offline, so setDoc can stay
 * pending indefinitely instead of rejecting. The bytes are already in Storage by
 * then, so the student needs an answer rather than a spinner.
 */
const METADATA_WRITE_TIMEOUT_MS = 20_000;

export interface UploadProgress {
  /** 0-100, from bytes actually transferred. */
  percent: number;
  bytesTransferred: number;
  totalBytes: number;
}

export async function uploadStudyDocument(
  userId: string,
  file: File,
  metadata?: Partial<StudyDocument>,
  onProgress?: (progress: UploadProgress) => void
): Promise<StudyDocument> {
  const timestamp = Date.now();
  const docId = `doc-${timestamp}`;

  // Everything except where the bytes actually live. Each branch below supplies
  // fileUrl (and storagePath) according to what it can genuinely promise.
  const base = {
    id: docId,
    title: metadata?.title?.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
    fileName: file.name,
    fileType: file.type || "application/pdf",
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    courseTag: metadata?.courseTag || "General",
    category: metadata?.category || "Lecture Slide",
    pinned: metadata?.pinned ?? false,
  };

  // Guest Scholars have no Firebase Auth user, so Storage and Firestore both
  // refuse them by rule. Their vault is local-only by design.
  if (!userId || userId === GUEST_USER_ID) {
    const objectUrl = URL.createObjectURL(file);

    // The object URL is valid only for the page that created it, so it is handed
    // back for this session but deliberately not written to localStorage: a
    // stored blob: URL is already dead on the next reload, and a card that
    // silently opens nothing is worse than one that admits the file is gone.
    const persisted: StudyDocument = { ...base, userId: GUEST_USER_ID, fileUrl: "" };
    try {
      const saved = localStorage.getItem("studispace_guest_documents");
      const currentList: StudyDocument[] = saved ? JSON.parse(saved) : INITIAL_STUDY_DOCUMENTS;
      localStorage.setItem(
        "studispace_guest_documents",
        JSON.stringify([persisted, ...currentList])
      );
    } catch (localErr) {
      console.warn("Guest storage write failed:", localErr);
    }

    return { ...persisted, fileUrl: objectUrl };
  }

  // A bucket that did not answer a moment ago will not answer now. Refusing up
  // front keeps the student from sitting through the stall timeout again.
  if (storageLooksUnavailable) {
    throw new StorageUnavailableError(
      `"${file.name}" cannot be stored right now. ${STORAGE_UNPROVISIONED_MESSAGE}`
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `users/${userId}/documents/${timestamp}_${safeName}`;
  const storageRef = ref(storage, storagePath);

  // A signed-in student's vault has to survive a reload, so the bytes must
  // really reach Storage. There is no blob: fallback here on purpose: it would
  // put a URL into Firestore that is broken the moment the tab closes, and sync
  // that broken record to every other device.
  //
  // uploadBytes() is a single shot with no progress events and no way to give
  // up: a 16MB textbook reported nothing until it finished, and a stalled
  // connection simply never settled. uploadBytesResumable reports real byte
  // progress and can be cancelled, which is what makes both fixable.
  let fileUrl: string;
  try {
    fileUrl = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });

      let lastMovedAt = Date.now();
      let movedAnyBytes = false;
      const stallCheck = setInterval(() => {
        if (Date.now() - lastMovedAt < UPLOAD_STALL_TIMEOUT_MS) return;
        clearInterval(stallCheck);
        // cancel() makes the task emit its own error, which the observer below
        // turns into the rejection. Reject here too in case it does not.
        task.cancel();
        reject(describeStall(file.name, movedAnyBytes));
      }, 5_000);

      task.on(
        "state_changed",
        (snapshot) => {
          lastMovedAt = Date.now();
          if (snapshot.bytesTransferred > 0) movedAnyBytes = true;
          onProgress?.({
            percent: snapshot.totalBytes
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0,
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
          });
        },
        (err) => {
          clearInterval(stallCheck);
          reject(err);
        },
        () => {
          clearInterval(stallCheck);
          markStorageReachable();
          getDownloadURL(task.snapshot.ref).then(resolve, reject);
        }
      );
    });
  } catch (err: any) {
    // Re-throw the unprovisioned-storage case as-is: wrapping it would hide the
    // type the Vault uses to tell "set this up" apart from "try again".
    if (isStorageUnavailable(err)) throw err;
    throw new Error(
      `Could not upload "${file.name}" to your vault: ${err?.message || "Firebase Storage is unreachable."}`
    );
  }

  const newDoc: StudyDocument = { ...base, userId, fileUrl, storagePath };

  try {
    await withTimeout(
      setDoc(doc(db, "documents", docId), newDoc),
      METADATA_WRITE_TIMEOUT_MS,
      "Saving the document details timed out. The file uploaded, but your vault could not record it."
    );
  } catch (firestoreErr: any) {
    // The file is in Storage but nothing points at it. Drop it rather than
    // leaving an orphan the student is billed for and can never see.
    await deleteObject(storageRef).catch(() => {});
    throw new Error(
      `"${file.name}" was uploaded but could not be saved to your vault: ${
        firestoreErr?.message || "Firestore write failed."
      }`
    );
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

