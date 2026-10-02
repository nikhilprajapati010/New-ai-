import { useState, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext.tsx";
import { Navbar } from "./components/Navbar.tsx";
import { UserChat } from "./components/UserChat.tsx";
import { AdminDashboard } from "./components/AdminDashboard.tsx";
import { ModelTierConfig } from "./types.ts";

export default function App() {
  const [currentTier, setCurrentTier] = useState<"user" | "admin">("user");
  const [killSwitch, setKillSwitch] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<ModelTierConfig | null>(null);
  const [isModelLocked, setIsModelLocked] = useState<boolean>(false);

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

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
        {/* Navigation Bar */}
        <Navbar
          currentTier={currentTier}
          onSelectTier={setCurrentTier}
          killSwitch={killSwitch}
          activeModel={activeModel}
          isModelLocked={isModelLocked}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full">
          {currentTier === "user" ? (
            <UserChat />
          ) : (
            <AdminDashboard />
          )}
        </main>
      </div>
    </AuthProvider>
  );
}
