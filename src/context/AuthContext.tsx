import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  User,
  signInWithPopup,
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
import { auth, db, googleProvider } from "../utils/firebase";
import { UserStats } from "../types";
import { INITIAL_STATS } from "../utils/initialData";

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL: string;
  major: string;
  term: string;
  stats: UserStats;
  createdAt?: string;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    major?: string,
    term?: string
  ) => Promise<void>;
  guestSignIn: () => void;
  logout: () => Promise<void>;
  updateUserStats: (newStats: Partial<UserStats>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sign-up writes the profile the student actually filled in. Creating an
  // account fires onAuthStateChanged immediately, so without this flag both
  // paths race to create users/{uid} and the generic defaults can land last,
  // silently discarding the chosen name, major and term.
  const signUpInFlight = useRef(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
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

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Sign In Error:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
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
    term?: string
  ) => {
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
        stats: INITIAL_STATS,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
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
      uid: "guest-scholar",
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
      userId: "guest-scholar",
      displayName: "Guest Scholar",
      email: "guest@studispace.os",
      photoURL: "",
      major: "Computer Science",
      term: "Fall 2026",
      stats: INITIAL_STATS,
    });
  };

  const logout = async () => {
    try {
      if (user?.uid === "guest-scholar") {
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
    if (!user || user.uid === "guest-scholar") return;
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

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        guestSignIn,
        logout,
        updateUserStats,
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
