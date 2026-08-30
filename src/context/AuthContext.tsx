import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { auth, db, googleProvider, firebaseConfigError, isFirebaseConfigured } from "../utils/firebase";
import { describeAuthError } from "../utils/authErrors";
import { UserStats } from "../types";
import { GUEST_USER_ID, INITIAL_STATS } from "../utils/initialData";

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  major: string;
  term: string;
  university?: string;
  year?: string;
  bio?: string;
  targetGpa?: number;
  studyGoal?: string;
  avatarBg?: string;
  stats: UserStats;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  /** Set when a redirect-based Google sign-in came back with an error. */
  authError: string | null;
  /** Set when VITE_FIREBASE_* config is incomplete; sign-in cannot work until fixed. */
  configError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    major?: string,
    term?: string,
    university?: string,
    year?: string
  ) => Promise<void>;
  guestSignIn: () => void;
  logout: () => Promise<void>;
  updateUserStats: (newStats: Partial<UserStats>) => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Popups are the better experience (the app keeps its state), but browsers and
// embedded webviews block them often enough that a popup-only implementation
// leaves Google sign-in permanently dead for those students. These codes mean
// "no popup available", so we retry via the redirect flow instead;
// getRedirectResult() picks the answer up when the browser navigates back.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  // Sign-up writes the profile the student actually filled in. Creating an
  // account fires onAuthStateChanged immediately, so without this flag both
  // paths race to create users/{uid} and the generic defaults can land last,
  // silently discarding the chosen name, major and term.
  const signUpInFlight = useRef(false);

  // A redirect sign-in finishes on a fresh page load, so its failure cannot be
  // thrown back to whoever called signInWithGoogle. Surface it here instead.
  useEffect(() => {
    // Nothing can come back from a redirect that was never possible to start,
    // and asking with a placeholder key only logs an error about the key that
    // buries the one about the configuration.
    if (!isFirebaseConfigured) return;

    getRedirectResult(auth).catch((err) => {
      console.error("Google Redirect Sign In Error:", err);
      setRedirectError(describeAuthError(err));
    });
  }, []);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Detach the previous account's profile listener before doing anything
      // else. It was opened under the old uid, so once that user signs out (or
      // is replaced by another) the rules correctly reject it and it spews
      // permission-denied for as long as it stays attached.
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      setUser(currentUser);

      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);

        try {
          const docSnap = await getDoc(userDocRef);

          if (signUpInFlight.current) {
            // signUpWithEmail owns profile creation for this account.
          } else if (!docSnap.exists()) {
            const initialProfile: UserProfile = {
              userId: currentUser.uid,
              displayName: currentUser.displayName || "Scholar",
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              major: "Computer Science",
              term: "Fall 2026",
              stats: INITIAL_STATS,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
          } else {
            await updateDoc(userDocRef, {
              lastLoginAt: new Date().toISOString(),
              photoURL: currentUser.photoURL || docSnap.data()?.photoURL || "",
              displayName: currentUser.displayName || docSnap.data()?.displayName || "Scholar",
            });
          }
        } catch (err) {
          console.error("Error setting up user profile document:", err);
        }

        // Subscribe to real-time user document changes
        unsubscribeDoc = onSnapshot(
          userDocRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data() as UserProfile);
            }
          },
          (err) => {
            console.error("User snapshot error:", err);
          }
        );
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  /**
   * Every path below reaches a real Firebase project. When there is no project
   * configured the SDK is holding a placeholder API key, so letting a request
   * through would fail at the network with an error about the key rather than
   * about the setup. Stop here and say the actual reason instead.
   */
  const requireFirebase = () => {
    if (!isFirebaseConfigured) {
      throw new Error(
        firebaseConfigError ?? "Firebase is not configured, so signing in is unavailable."
      );
    }
  };

  const signInWithGoogle = async () => {
    requireFirebase();
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (POPUP_FALLBACK_CODES.has(err?.code)) {
        console.warn(`Google popup unavailable (${err.code}); falling back to redirect sign-in.`);
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error("Google Sign In Error:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    requireFirebase();
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error("Email Sign In Error:", err);
      throw err;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    major?: string,
    term?: string,
    university?: string,
    year?: string
  ) => {
    requireFirebase();
    signUpInFlight.current = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        pass
      );
      const newUser = userCredential.user;

      // Update Firebase Auth displayName
      await updateProfile(newUser, {
        displayName: displayName || "Scholar",
      });

      // Create initial profile in Firestore
      const userDocRef = doc(db, "users", newUser.uid);
      const newProfile: UserProfile = {
        userId: newUser.uid,
        displayName: displayName || "Scholar",
        email: newUser.email || email,
        photoURL: "",
        major: major || "Computer Science",
        term: term || "Fall 2026",
        university: university || "",
        year: year || "4th Year (Senior)",
        bio: "Curious student aiming for academic excellence.",
        targetGpa: 3.8,
        studyGoal: "3 hours/day",
        avatarBg: "#FFE600",
        stats: INITIAL_STATS,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newProfile);
      setUserProfile(newProfile);
    } catch (err: any) {
      console.error("Sign Up Error:", err);
      throw err;
    } finally {
      signUpInFlight.current = false;
    }
  };

  const guestSignIn = () => {
    // Allows immediate exploration mode
    setUser({
      uid: GUEST_USER_ID,
      displayName: "Guest Scholar",
      email: "guest@studispace.os",
      photoURL: "",
      emailVerified: true,
      isAnonymous: true,
      metadata: {},
      providerData: [],
      refreshToken: "",
      tenantId: null,
      delete: async () => {},
      getIdToken: async () => "",
      getIdTokenResult: async () => ({} as any),
      reload: async () => {},
      toJSON: () => ({}),
      phoneNumber: null,
      providerId: "guest",
    } as unknown as User);

    setUserProfile({
      userId: GUEST_USER_ID,
      displayName: "Guest Scholar",
      email: "guest@studispace.os",
      photoURL: "",
      major: "Computer Science",
      term: "Fall 2026",
      university: "StudiSpace Academy",
      year: "Senior",
      bio: "Exploring StudiSpace Academic Operating System.",
      targetGpa: 3.9,
      studyGoal: "2.5 hours/day",
      avatarBg: "#FFE600",
      stats: INITIAL_STATS,
    });
  };

  const logout = async () => {
    try {
      if (user?.uid === GUEST_USER_ID) {
        setUser(null);
        setUserProfile(null);
        return;
      }
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (err: any) {
      console.error("Sign Out Error:", err);
      throw err;
    }
  };

  const updateUserStats = async (newStats: Partial<UserStats>) => {
    if (!user || user.uid === GUEST_USER_ID) {
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          stats: {
            ...userProfile.stats,
            ...newStats,
          },
        });
      }
      return;
    }
    try {
      const userDocRef = doc(db, "users", user.uid);
      const currentStats = userProfile?.stats || INITIAL_STATS;
      const mergedStats: UserStats = {
        ...currentStats,
        ...newStats,
      };
      await updateDoc(userDocRef, {
        stats: mergedStats,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to update user stats in Firestore:", err);
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    const updatedProfile = userProfile ? { ...userProfile, ...updates, updatedAt: new Date().toISOString() } : null;
    setUserProfile(updatedProfile);

    // Update Firebase Auth displayName if changed
    if (user && updates.displayName && user.uid !== GUEST_USER_ID) {
      try {
        await updateProfile(user, {
          displayName: updates.displayName,
          photoURL: updates.photoURL !== undefined ? updates.photoURL : user.photoURL,
        });
      } catch (authErr) {
        console.warn("Could not update auth display profile:", authErr);
      }
    }

    // Update Firestore user document
    if (user && user.uid !== GUEST_USER_ID) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to update user profile in Firestore:", err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authError: redirectError,
        configError: firebaseConfigError,
        clearAuthError: () => setRedirectError(null),
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        guestSignIn,
        logout,
        updateUserStats,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
