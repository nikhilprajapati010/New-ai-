import React from "react";
import { AlertTriangle, Check, X, ShieldAlert, FileCode, ArrowRight, ExternalLink } from "lucide-react";
import { PendingUpdate } from "../types.ts";

interface ApprovalRequiredAlertProps {
  pr: PendingUpdate;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onInspect: (id: string) => void;
  isLoading: boolean;
}

export const ApprovalRequiredAlert: React.FC<ApprovalRequiredAlertProps> = ({
  pr,
  onApprove,
  onReject,
  onInspect,
  isLoading,
}) => {
  const risk = pr.impactRisk;

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 border-2 border-rose-500 shadow-2xl shadow-rose-950/50 animate-in fade-in slide-in-from-top-3 duration-300 relative overflow-hidden">
      {/* Background pulsating hazard line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 animate-pulse" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Alert Information & Reasons */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Approval Required: High-Impact System Change Detected
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/30 border border-rose-400/50 text-rose-200">
                  {risk?.severity || "CRITICAL"} SEVERITY
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  Risk Score: <strong className="text-rose-400">{risk?.riskScore || 85}/100</strong>
                </span>
              </div>
              <p className="text-xs text-rose-200/80 mt-0.5">
                Vanguard AI upgrade pipeline is safely held at Phase 4. Manual Executive sign-off is required before merging.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-rose-900/50 space-y-1 text-xs">
            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-300">
              <FileCode className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold text-rose-300">{pr.targetFile}</span>
              <span className="text-slate-500">({pr.branch})</span>
            </div>
            <div className="text-slate-200 font-semibold text-xs pt-1">{pr.title}</div>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              {risk?.reasons?.[0] || pr.summary}
            </div>
          </div>
        </div>

        {/* Right: Approve & Reject Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 self-end lg:self-center">
          <button
            onClick={() => onInspect(pr.id)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
          >
            <span>Review Diff</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onReject(pr.id)}
            disabled={isLoading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-rose-400 hover:text-rose-300 border border-rose-900/60 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Reject Patch</span>
          </button>

          <button
            onClick={() => onApprove(pr.id)}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40 text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/70 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Approve & Merge to Production</span>
          </button>
        </div>
      </div>
    </div>
  );
};
