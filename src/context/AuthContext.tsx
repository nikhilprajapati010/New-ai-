import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle as fbSignInWithGoogle, logOut as fbLogOut } from "../firebase.ts";
import { UserProfile, UserRole } from "../types.ts";

export const ADMIN_SECRET_KEY = "456123";
export const PRIMARY_ADMIN_EMAIL = "nikhilprajapathi1@gmail.com";

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  adminAuthenticated: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithGoogleAccount: (email: string, displayName?: string, photoURL?: string) => void;
  elevateToAdmin: (key: string) => boolean;
  lockAdmin: () => void;
  logout: () => Promise<void>;
  setSimulatedRole: (role: UserRole) => void;
  isSimulated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem("vanguard_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("vanguard_admin_key") === ADMIN_SECRET_KEY;
  });

  const [loading, setLoading] = useState(true);

  // Sync auth state with Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        const isOwner = user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
        const hasAdminKey = sessionStorage.getItem("vanguard_admin_key") === ADMIN_SECRET_KEY;
        const assignedRole: UserRole = hasAdminKey || isOwner ? "ADMIN" : "USER";

        if (hasAdminKey || isOwner) {
          sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
          setAdminAuthenticated(true);
        }

        const profile: UserProfile = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "Google User",
          role: assignedRole,
          photoURL: user.photoURL || undefined,
        };

        setCurrentUser(profile);
        sessionStorage.setItem("vanguard_user", JSON.stringify(profile));
        sessionStorage.setItem("vanguard_signed_in", "true");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const cred = await fbSignInWithGoogle();
      if (cred && cred.user) {
        const isOwner = cred.user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
        const hasAdminKey = sessionStorage.getItem("vanguard_admin_key") === ADMIN_SECRET_KEY;
        const assignedRole: UserRole = hasAdminKey || isOwner ? "ADMIN" : "USER";

        if (hasAdminKey || isOwner) {
          sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
          setAdminAuthenticated(true);
        }

        const profile: UserProfile = {
          uid: cred.user.uid,
          email: cred.user.email || "",
          displayName: cred.user.displayName || cred.user.email?.split("@")[0] || "Google User",
          role: assignedRole,
          photoURL: cred.user.photoURL || undefined,
        };

        setCurrentUser(profile);
        sessionStorage.setItem("vanguard_user", JSON.stringify(profile));
        sessionStorage.setItem("vanguard_signed_in", "true");
      }
    } catch (err) {
      console.error("Firebase Google Sign-In error:", err);
      throw err;
    }
  };

  const loginWithGoogleAccount = (email: string, displayName?: string, photoURL?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isOwner = cleanEmail === PRIMARY_ADMIN_EMAIL.toLowerCase();
    const hasAdminKey = sessionStorage.getItem("vanguard_admin_key") === ADMIN_SECRET_KEY;
    const assignedRole: UserRole = hasAdminKey || isOwner ? "ADMIN" : "USER";

    if (hasAdminKey || isOwner) {
      sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
      setAdminAuthenticated(true);
    }

    const profile: UserProfile = {
      uid: `google-${Date.now()}`,
      email: cleanEmail,
      displayName: displayName || cleanEmail.split("@")[0],
      role: assignedRole,
      photoURL,
    };

    setCurrentUser(profile);
    sessionStorage.setItem("vanguard_user", JSON.stringify(profile));
    sessionStorage.setItem("vanguard_signed_in", "true");
  };

  const elevateToAdmin = (key: string): boolean => {
    if (key.trim() === ADMIN_SECRET_KEY) {
      sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
      setAdminAuthenticated(true);
      if (currentUser) {
        const updated = { ...currentUser, role: "ADMIN" as UserRole };
        setCurrentUser(updated);
        sessionStorage.setItem("vanguard_user", JSON.stringify(updated));
      }
      return true;
    }
    return false;
  };

  const lockAdmin = () => {
    sessionStorage.removeItem("vanguard_admin_key");
    setAdminAuthenticated(false);
    if (currentUser) {
      const updated = { ...currentUser, role: "USER" as UserRole };
      setCurrentUser(updated);
      sessionStorage.setItem("vanguard_user", JSON.stringify(updated));
    }
  };

  const logout = async () => {
    sessionStorage.removeItem("vanguard_user");
    sessionStorage.removeItem("vanguard_signed_in");
    sessionStorage.removeItem("vanguard_admin_key");
    sessionStorage.removeItem("vanguard_user_name");
    setAdminAuthenticated(false);
    setCurrentUser(null);
    setFirebaseUser(null);
    try {
      await fbLogOut();
    } catch (e) {
      console.warn("Sign out cleanup:", e);
    }
  };

  const setSimulatedRole = (role: UserRole) => {
    if (currentUser) {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
      sessionStorage.setItem("vanguard_user", JSON.stringify(updated));
      if (role === "ADMIN") {
        sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
        setAdminAuthenticated(true);
      } else {
        sessionStorage.removeItem("vanguard_admin_key");
        setAdminAuthenticated(false);
      }
    }
  };

  const isAdmin = adminAuthenticated || currentUser?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isAdmin,
        adminAuthenticated: isAdmin,
        loginWithGoogle,
        loginWithGoogleAccount,
        elevateToAdmin,
        lockAdmin,
        logout,
        setSimulatedRole,
        isSimulated: !firebaseUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
