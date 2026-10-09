import React, { useState } from "react";
import { Zap, ShieldAlert, CheckCircle2, RefreshCw, Cpu, Bug, ArrowRight, ShieldCheck, FileCode } from "lucide-react";

interface FastCodeAuditCardProps {
  onRunAudit: () => Promise<void>;
  onSimulateFlaw: () => Promise<void>;
  isLoading: boolean;
  auditRate?: number;
}

export const FastCodeAuditCard: React.FC<FastCodeAuditCardProps> = ({
  onRunAudit,
  onSimulateFlaw,
  isLoading,
  auditRate = 128,
}) => {
  const [activeNotice, setActiveNotice] = useState<string | null>(null);

  const handleAuditClick = async () => {
    setActiveNotice("Initiating Accelerated Self-Code Audit: AST scan -> Direct to Phase 3 Sandbox...");
    await onRunAudit();
    setTimeout(() => setActiveNotice(null), 4000);
  };

  const handleSimulateClick = async () => {
    setActiveNotice("Injecting simulated syntax flaw to verify Phase 3 Zero-Error Gatekeeper rollback...");
    await onSimulateFlaw();
    setTimeout(() => setActiveNotice(null), 5000);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2 flex-wrap">
              Accelerated Self-Code Audit Engine
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold uppercase">
                Auditing: {auditRate} files/sec | Fast-Track Active
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Phase 3 Gatekeeper Enforced
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Continuous background AST scanner inspecting Vanguard AI's local codebase (<code className="text-slate-300">/src</code>, <code className="text-slate-300">/server</code>). Bypasses Phase 2 and routes directly into Phase 3 Sandbox Testing with 100% pass enforcement.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleSimulateClick}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Inject simulated syntax flaw to demonstrate zero-error rollback"
          >
            <Bug className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate Sandbox Flaw & Test 100% Gatekeeper</span>
          </button>

          <button
            onClick={handleAuditClick}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-md shadow-amber-950/40 border border-amber-400/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Run Accelerated Self-Code Audit</span>
          </button>
        </div>
      </div>

      {activeNotice && (
        <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/30 text-xs font-mono text-amber-300 flex items-center space-x-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{activeNotice}</span>
        </div>
      )}

      {/* Feature Guarantee Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center space-x-2 text-amber-300 font-semibold mb-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Local Codebase AST Scan</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Inspects 48+ AST nodes across <code className="text-slate-300">/src</code> & <code className="text-slate-300">/server</code> for concurrency bottlenecks & memory leaks.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="flex items-center space-x-2 text-cyan-300 font-semibold mb-1">
            <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            <span>Direct Phase 3 Route</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Fast-tracking <strong>ONLY bypasses Phase 2</strong> (Web Ingestion). It MANDATORILY routes changes directly into Phase 3 Sandbox Testing.
          </p>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30">
          <div className="flex items-center space-x-2 text-emerald-300 font-semibold mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% Pass Enforcement</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Zero errors allowed. If a single assertion fails, patch is instantly rejected, rolled back, and sent to self-healing repair.
          </p>
        </div>
      </div>
    </div>
  );
};
