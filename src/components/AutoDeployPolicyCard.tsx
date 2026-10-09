import React from "react";
import { ShieldCheck, Zap, Lock, Sliders, CheckCircle2, AlertOctagon } from "lucide-react";
import { AutoDeployPolicy } from "../types.ts";

interface AutoDeployPolicyCardProps {
  currentPolicy: AutoDeployPolicy;
  onUpdatePolicy: (newPolicy: AutoDeployPolicy) => Promise<void>;
  isLoading: boolean;
}

export const AutoDeployPolicyCard: React.FC<AutoDeployPolicyCardProps> = ({
  currentPolicy,
  onUpdatePolicy,
  isLoading,
}) => {
  const isFullAutonomy = currentPolicy === "FULL_AUTONOMY";

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Auto-Deploy Permission Policy
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                  isFullAutonomy
                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                    : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                }`}
              >
                {isFullAutonomy ? "Full Autonomy Active" : "Strict Mode Active"}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Configure smart permission gating: auto-deploy routine optimizations vs requiring executive sign-off.
            </p>
          </div>
        </div>

        {/* Policy Switch Toggles */}
        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
          <button
            onClick={() => onUpdatePolicy("FULL_AUTONOMY")}
            disabled={isLoading || isFullAutonomy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              isFullAutonomy
                ? "bg-cyan-600 text-white shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Full Autonomy</span>
          </button>

          <button
            onClick={() => onUpdatePolicy("STRICT_MODE")}
            disabled={isLoading || !isFullAutonomy}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
              !isFullAutonomy
                ? "bg-amber-600 text-white shadow-md font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Mode</span>
          </button>
        </div>
      </div>

      {/* Two Tiers Policy Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Tier 1: Routine / Minor Changes */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isFullAutonomy
              ? "bg-slate-950/90 border-cyan-500/30 ring-1 ring-cyan-500/20 shadow-sm"
              : "bg-slate-950/40 border-slate-800/60 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 text-cyan-300 font-semibold">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Routine & Minor Changes</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                isFullAutonomy
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {isFullAutonomy ? "Zero Permission (Auto-Deploy)" : "Approval Required"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            Bug fixes, performance tweaks, code styling, minor UI refactoring, or non-breaking internal optimizations with 100% sandbox test pass rate.
          </p>
          <div className="text-[10px] font-mono text-slate-500 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Auto-merges directly into production with zero delay</span>
          </div>
        </div>

        {/* Tier 2: Important / Critical Changes */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isFullAutonomy
              ? "bg-slate-950/90 border-rose-500/30 ring-1 ring-rose-500/20 shadow-sm"
              : "bg-slate-950/90 border-amber-500/40 ring-1 ring-amber-500/20"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1.5 text-rose-300 font-semibold">
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Important & Critical Changes</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Admin Approval Required
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
            Database schema migrations, authentication or security logic changes, breaking API updates, or adding new external dependencies.
          </p>
          <div className="text-[10px] font-mono text-amber-400 flex items-center space-x-1">
            <Lock className="w-3 h-3" />
            <span>Pauses pipeline at Phase 4 until Admin clicks [Approve & Merge]</span>
          </div>
        </div>
      </div>
    </div>
  );
};
