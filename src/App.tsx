import { useState, useEffect } from "react";
import { AuthProvider, useAuth, ADMIN_SECRET_KEY } from "./context/AuthContext.tsx";
import { Navbar } from "./components/Navbar.tsx";
import { UserChat } from "./components/UserChat.tsx";
import { AdminDashboard } from "./components/AdminDashboard.tsx";
import { AdminAuthModal } from "./components/AdminAuthModal.tsx";
import { SignInScreen } from "./components/SignInScreen.tsx";
import { ModelTierConfig } from "./types.ts";

function VanguardApp() {
  const { currentUser, isAdmin, adminAuthenticated, elevateToAdmin, lockAdmin, logout, loading } = useAuth();

  const [currentTier, setCurrentTier] = useState<"user" | "admin">("user");
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<ModelTierConfig | null>(null);
  const [isModelLocked, setIsModelLocked] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // Automatically sync currentTier with admin authentication state
  useEffect(() => {
    if (adminAuthenticated) {
      setCurrentTier("admin");
    } else {
      setCurrentTier("user");
    }
  }, [adminAuthenticated]);

  // Poll system state periodically to keep kill switch and active model indicator in sync
  useEffect(() => {
    const checkState = async () => {
      try {
        const [stateRes, routerRes] = await Promise.all([
          fetch("/api/system/state"),
          fetch("/api/system/model-router"),
        ]);

        if (stateRes.ok) {
          const data = await stateRes.json();
          setKillSwitch(Boolean(data.state?.killSwitch));
          if (data.activeModel) setActiveModel(data.activeModel);
        }

        if (routerRes.ok) {
          const rData = await routerRes.json();
          setActiveModel(rData.activeModel);
          setIsModelLocked(rData.isLocked);
        }
      } catch {
        // Silently catch network errors during dev reload
      }
    };

    checkState();
    const interval = setInterval(checkState, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTier = (tier: "user" | "admin") => {
    if (tier === "admin") {
      if (adminAuthenticated) {
        setCurrentTier("admin");
      } else {
        setIsAdminModalOpen(true);
      }
    } else {
      setCurrentTier("user");
    }
  };

  const handleAdminAuthSuccess = (key: string) => {
    elevateToAdmin(key);
    setCurrentTier("admin");
    setIsAdminModalOpen(false);
  };

  const handleLockAdmin = () => {
    lockAdmin();
    setCurrentTier("user");
  };

  const handleSignOut = async () => {
    await logout();
    setCurrentTier("user");
  };

  // Mandatory Google Sign-In Gatekeeper:
  // Users cannot access the chat interface or dashboard without signing in
  if (!currentUser && !loading) {
    return <SignInScreen />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading Vanguard AI Core...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Navigation Bar */}
      <Navbar
        currentTier={currentTier}
        onSelectTier={handleSelectTier}
        killSwitch={killSwitch}
        activeModel={activeModel}
        isModelLocked={isModelLocked}
        adminAuthenticated={adminAuthenticated}
        onLockAdmin={handleLockAdmin}
        onSignOut={handleSignOut}
        onOpenElevateModal={() => setIsAdminModalOpen(true)}
        userName={currentUser?.displayName || currentUser?.email || "User"}
      />

      {/* Main Content Area: User Chat or Admin Dashboard */}
      <main className="flex-1 w-full">
        {currentTier === "user" ? (
          <UserChat />
        ) : (
          <AdminDashboard onLockSession={handleLockAdmin} />
        )}
      </main>

      {/* Strict Admin Authentication Security Modal */}
      <AdminAuthModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminAuthSuccess}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <VanguardApp />
    </AuthProvider>
  );
}
