import React from "react";
import { Shield, MessageSquare, AlertOctagon, LogIn, LogOut, CheckCircle2, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { ModelTierConfig } from "../types.ts";

interface NavbarProps {
  currentTier: "user" | "admin";
  onSelectTier: (tier: "user" | "admin") => void;
  killSwitch: boolean;
  activeModel?: ModelTierConfig | null;
  isModelLocked?: boolean;
  adminAuthenticated?: boolean;
  onLockAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTier,
  onSelectTier,
  killSwitch,
  activeModel,
  isModelLocked,
  adminAuthenticated,
  onLockAdmin,
}) => {
  const { isAdmin, loginWithGoogle, logout, setSimulatedRole, firebaseUser } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand & Active Model */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-xs">
              V
            </div>
            <span className="font-semibold text-slate-100 text-sm tracking-tight">
              Vanguard AI
            </span>
          </div>

          {/* Active Model Indicator */}
          {activeModel && (
            <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">Core:</span>
              <span className="font-medium text-cyan-300">{activeModel.name}</span>
              {isModelLocked && (
                <span className="text-[9px] uppercase px-1 rounded bg-amber-950/80 text-amber-300 font-mono">
                  Locked
                </span>
              )}
            </div>
          )}

          {killSwitch && (
            <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-medium">
              <AlertOctagon className="w-3 h-3" />
              <span>Halted</span>
            </span>
          )}
        </div>

        {/* Segmented Mode Selector */}
        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onSelectTier("user")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              currentTier === "user"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => onSelectTier("admin")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              currentTier === "admin"
                ? "bg-slate-800 text-white shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>
        </div>

        {/* Right: Auth & Role */}
        <div className="flex items-center space-x-2 text-xs">
          {adminAuthenticated && onLockAdmin && (
            <button
              onClick={onLockAdmin}
              className="px-2 py-1 rounded text-[11px] font-mono bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center space-x-1"
              title="Lock Admin Session (Key: 456123)"
            >
              <span>Lock Admin</span>
            </button>
          )}

          {/* Quick Role Toggle for Testing */}
          <button
            onClick={() => setSimulatedRole(isAdmin ? "USER" : "ADMIN")}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
              isAdmin
                ? "bg-violet-950/40 text-violet-300 border-violet-800/40 hover:bg-violet-900/50"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
            }`}
            title="Toggle between Admin and User role for testing"
          >
            {isAdmin ? "Admin" : "User"}
          </button>

          {firebaseUser ? (
            <div className="flex items-center space-x-2 pl-1">
              <span title="Firebase Authenticated">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </span>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center space-x-1 text-slate-400 hover:text-white px-2 py-1 rounded transition-colors cursor-pointer"
              title="Sign in with Google"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
