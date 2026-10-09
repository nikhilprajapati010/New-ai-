import React, { useState } from "react";
import { ShieldAlert, Key, ArrowRight, X, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { sanitizeClientInput } from "../utils/sanitize.ts";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (key: string) => void;
}

export const ADMIN_SECRET_KEY = "456123";

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [inputKey, setInputKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    const sanitizedKey = sanitizeClientInput(inputKey.trim(), 32);

    // Verify against hardcoded secret key '456123'
    if (sanitizedKey === ADMIN_SECRET_KEY) {
      sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
      setTimeout(() => {
        setIsVerifying(false);
        onSuccess(ADMIN_SECRET_KEY);
      }, 250);
      return;
    }

    // Try backend verification check as well
    try {
      const res = await fetch("/api/system/auth/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: sanitizedKey }),
      });

      if (res.ok) {
        sessionStorage.setItem("vanguard_admin_key", ADMIN_SECRET_KEY);
        onSuccess(ADMIN_SECRET_KEY);
      } else if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Too many failed attempts. Security throttle active.");
      } else {
        setError("Invalid Admin Security Key. Access strictly denied.");
      }
    } catch {
      setError("Authentication failed. Security key does not match.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl shadow-cyan-950/40 text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">
              Admin Security Verification
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Vanguard AI Executive Control Access
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Access to the Autonomous Upgrade Controller, Infinite Passive Learning Engine, Self-Diagnostics, and Omniscient File System requires the verified Admin Security Key.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5 font-medium">
              Admin Security Key
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Enter 6-digit key (456123)"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 text-sm font-mono text-white placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !inputKey.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-cyan-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>{isVerifying ? "Verifying..." : "Authenticate & Unlock"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
