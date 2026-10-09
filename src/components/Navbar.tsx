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
  onSignOut?: () => void;
  onOpenElevateModal?: () => void;
  userName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTier,
  onSelectTier,
  killSwitch,
  activeModel,
  isModelLocked,
  adminAuthenticated,
  onLockAdmin,
  onSignOut,
  onOpenElevateModal,
  userName,
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

        {/* Segmented Mode Selector: Admin button is COMPLETELY HIDDEN in Standard User Mode */}
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

          {/* Strict Role-Based Admin Button Visibility: Visible ONLY if admin authenticated via 456123 */}
          {adminAuthenticated && (
            <button
              onClick={() => onSelectTier("admin")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer animate-in fade-in duration-150 ${
                currentTier === "admin"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-400/90 hover:text-amber-300 hover:bg-slate-850"
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Admin</span>
            </button>
          )}
        </div>

        {/* Right: Auth, User Info & Session Exit */}
        <div className="flex items-center space-x-2 text-xs">
          {adminAuthenticated ? (
            <div className="flex items-center space-x-1.5">
              <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                Admin: 456123
              </span>
              {onLockAdmin && (
                <button
                  onClick={onLockAdmin}
                  className="px-2 py-1 rounded text-[11px] font-mono bg-rose-950/40 text-rose-300 border border-rose-800/40 hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center space-x-1"
                  title="Lock Admin Session (Key: 456123)"
                >
                  <span>Lock Admin</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <span className="hidden sm:inline text-[11px] font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {userName || "Standard User"}
              </span>
              {onOpenElevateModal && (
                <button
                  onClick={onOpenElevateModal}
                  className="px-2 py-1 rounded text-[11px] font-medium bg-slate-900 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-800/40 transition-colors cursor-pointer flex items-center space-x-1"
                  title="Elevate Privileges with Admin Security Key (456123)"
                >
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span className="hidden xs:inline">Elevate</span>
                </button>
              )}
            </div>
          )}

          {/* Exit / Sign Out Button */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer"
              title="Sign Out to Gatekeeper Screen"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
