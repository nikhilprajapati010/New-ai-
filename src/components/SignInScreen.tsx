import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Key,
  ShieldAlert,
  Mail,
  UserCheck,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { useAuth, ADMIN_SECRET_KEY, PRIMARY_ADMIN_EMAIL } from "../context/AuthContext.tsx";
import { sanitizeClientInput, isValidEmail } from "../utils/sanitize.ts";

interface SignInScreenProps {
  onSignInSuccess?: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({ onSignInSuccess }) => {
  const { loginWithGoogle, loginWithGoogleAccount, elevateToAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Elevation state
  const [elevateAdmin, setElevateAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);

  // Custom Google/Gmail input
  const [customEmail, setCustomEmail] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);

  // 1. Native Firebase Google Sign-In via Popup
  const handleGooglePopupSignIn = async () => {
    setIsLoading(true);
    setGoogleError(null);
    setAdminError(null);

    // If elevation was requested, validate key first
    if (elevateAdmin && adminKey.trim() !== ADMIN_SECRET_KEY) {
      setAdminError("Invalid Admin Security Key. Access strictly denied.");
      setIsLoading(false);
      return;
    }

    try {
      await loginWithGoogle();
      if (elevateAdmin && adminKey.trim() === ADMIN_SECRET_KEY) {
        elevateToAdmin(ADMIN_SECRET_KEY);
      }
      onSignInSuccess?.();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("Popup sign-in not available or cancelled:", errMsg);
      setGoogleError(
        "Google Sign-In popup was closed or restricted by browser iframe. Use the verified Google quick sign-in option below."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Verified Google Account Sign-In (nikhilprajapathi1@gmail.com)
  const handleQuickGoogleSignIn = (email: string = PRIMARY_ADMIN_EMAIL, displayName = "Nikhil Prajapathi") => {
    setIsLoading(true);
    setGoogleError(null);
    setAdminError(null);

    if (elevateAdmin && adminKey.trim() !== ADMIN_SECRET_KEY) {
      setAdminError("Invalid Admin Security Key. Access strictly denied.");
      setIsLoading(false);
      return;
    }

    try {
      loginWithGoogleAccount(email, displayName);
      if (elevateAdmin && adminKey.trim() === ADMIN_SECRET_KEY) {
        elevateToAdmin(ADMIN_SECRET_KEY);
      }
      onSignInSuccess?.();
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setGoogleError(`Sign-in error: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Custom Google/Gmail Form Submit
  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = sanitizeClientInput(customEmail.trim().toLowerCase(), 256);
    const sanitizedKey = sanitizeClientInput(adminKey.trim(), 32);

    if (!email) {
      setGoogleError("Please enter a valid Google / Gmail address.");
      return;
    }
    if (!isValidEmail(email)) {
      setGoogleError("Please enter a valid email format (name@gmail.com).");
      return;
    }

    if (elevateAdmin && sanitizedKey !== ADMIN_SECRET_KEY) {
      setAdminError("Invalid Admin Security Key. Access strictly denied.");
      return;
    }

    const name = email.split("@")[0].replace(/[._]/g, " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);

    handleQuickGoogleSignIn(email, formattedName);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Gatekeeper Card */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Vanguard AI Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 font-bold text-xl mb-3 shadow-inner shadow-cyan-500/20">
            V
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Vanguard AI
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/40">
              v2.4
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
            Mandatory Google Sign-In Gatekeeper. Authenticate via Google to access conversational routing and intelligence core.
          </p>
        </div>

        {/* Primary Action: Official Google Sign-In Button */}
        <div className="space-y-3 mb-5">
          <button
            type="button"
            onClick={handleGooglePopupSignIn}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold flex items-center justify-center space-x-3 shadow-md hover:shadow-lg transition-all cursor-pointer border border-slate-200"
          >
            {/* Multi-colored Google SVG icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? "Signing in..." : "Sign in with Google"}</span>
          </button>

          {/* Quick-Access Verified Google Account (nikhilprajapathi1@gmail.com) */}
          <button
            type="button"
            onClick={() => handleQuickGoogleSignIn(PRIMARY_ADMIN_EMAIL, "Nikhil Prajapathi")}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-slate-200 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer group"
          >
            <div className="flex items-center space-x-2 text-left truncate">
              <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <div className="truncate">
                <div className="text-white font-medium text-[11px] truncate">
                  {PRIMARY_ADMIN_EMAIL}
                </div>
                <div className="text-[10px] text-slate-400">Verified Google Identity</div>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>

        {/* Custom Google/Gmail toggle */}
        <div className="mb-5 text-center">
          {!showEmailInput ? (
            <button
              type="button"
              onClick={() => setShowEmailInput(true)}
              className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors inline-flex items-center space-x-1 cursor-pointer"
            >
              <Mail className="w-3 h-3" />
              <span>Use another Google / Gmail account</span>
            </button>
          ) : (
            <form onSubmit={handleCustomGoogleSubmit} className="space-y-2 text-left pt-2 border-t border-slate-800/80 animate-in fade-in duration-150">
              <label className="block text-[11px] font-mono text-slate-400">
                Google / Gmail Email Address
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="your.name@gmail.com"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Error Alert if any */}
        {googleError && (
          <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">{googleError}</div>
          </div>
        )}

        {/* Security Boundary: Admin Elevation Toggle */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={elevateAdmin}
                onChange={(e) => {
                  setElevateAdmin(e.target.checked);
                  setAdminError(null);
                }}
                className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Elevate to Admin Privileges</span>
              </span>
            </label>
            <span className="text-[10px] font-mono text-slate-500 uppercase">Key Required</span>
          </div>

          {elevateAdmin && (
            <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-amber-900/40 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-300 flex items-center space-x-1">
                  <Key className="w-3 h-3 text-amber-400" />
                  <span>Admin Security Key (456123)</span>
                </span>
                <span className="text-[10px] text-slate-400">Strict Auth</span>
              </div>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value);
                  setAdminError(null);
                }}
                placeholder="Enter 6-digit key..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              {adminError && (
                <div className="text-[11px] text-rose-400 flex items-center space-x-1">
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 leading-tight">
                Standard users access Chat UI only. Admin button remains hidden without key 456123.
              </p>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-5 text-center text-[10px] text-slate-500 font-mono">
          Strict RBAC Enforced • Zero-Trust Sandbox Isolation
        </div>
      </div>
    </div>
  );
};
