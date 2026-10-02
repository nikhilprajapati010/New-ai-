import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth, signInWithGoogle, logOut } from "../firebase.ts";
import { UserProfile, UserRole } from "../types.ts";

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  setSimulatedRole: (role: UserRole) => void;
  isSimulated: boolean;
}

const PRIMARY_ADMIN_EMAIL = "nikhilprajapathi1@gmail.com";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideRole, setOverrideRole] = useState<UserRole | null>(() => {
    return (localStorage.getItem("autodev_override_role") as UserRole) || null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user) {
        const isAdmin = user.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
        setCurrentUser({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split("@")[0] || "User",
          role: overrideRole || (isAdmin ? "ADMIN" : "USER"),
          photoURL: user.photoURL || undefined,
        });
      } else {
        // Fallback default admin profile for streamlined preview & evaluation
        const initialRole: UserRole = overrideRole || "ADMIN";
        setCurrentUser({
          uid: "exec-admin-local",
          email: PRIMARY_ADMIN_EMAIL,
          displayName: "Nikhil Prajapathi (Executive Admin)",
          role: initialRole,
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [overrideRole]);

  const loginWithGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Failed to sign in with Google:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await logOut();
      setCurrentUser(null);
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  const setSimulatedRole = (role: UserRole) => {
    setOverrideRole(role);
    localStorage.setItem("autodev_override_role", role);
    if (currentUser) {
      setCurrentUser({ ...currentUser, role });
    }
  };

  const isAdmin = currentUser?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        isAdmin,
        loginWithGoogle,
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
