import { useState, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext.tsx";
import { Navbar } from "./components/Navbar.tsx";
import { UserChat } from "./components/UserChat.tsx";
import { AdminDashboard } from "./components/AdminDashboard.tsx";
import { AdminAuthModal, ADMIN_SECRET_KEY } from "./components/AdminAuthModal.tsx";
import { ModelTierConfig } from "./types.ts";

export default function App() {
  const [currentTier, setCurrentTier] = useState<"user" | "admin">("user");
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<ModelTierConfig | null>(null);
  const [isModelLocked, setIsModelLocked] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(() => {
    return typeof window !== "undefined" && sessionStorage.getItem("vanguard_admin_key") === ADMIN_SECRET_KEY;
  });

  // Poll system state periodically to keep kill switch and model indicator in sync
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
      } catch (e) {
        // Silently catch network errors during dev reload
      }
    };

    checkState();
    const interval = setInterval(checkState, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTier = (tier: "user" | "admin") => {
    if (tier === "admin") {
      const storedKey = sessionStorage.getItem("vanguard_admin_key");
      if (storedKey === ADMIN_SECRET_KEY || adminAuthenticated) {
        setCurrentTier("admin");
      } else {
        setIsAdminModalOpen(true);
      }
    } else {
      setCurrentTier("user");
    }
  };

  const handleAdminAuthSuccess = (key: string) => {
    sessionStorage.setItem("vanguard_admin_key", key);
    setAdminAuthenticated(true);
    setCurrentTier("admin");
    setIsAdminModalOpen(false);
  };

  const handleLockAdmin = () => {
    sessionStorage.removeItem("vanguard_admin_key");
    setAdminAuthenticated(false);
    setCurrentTier("user");
  };

  return (
    <AuthProvider>
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
        />

        {/* Main Content Area */}
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
    </AuthProvider>
  );
}
