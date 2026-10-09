import React, { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Zap,
  CheckCircle2,
  FileCode,
  ArrowRight,
  ExternalLink,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { DiagnosticStatusResponse } from "../types.ts";

interface SelfDiagnosticCardProps {
  diagnosticData: DiagnosticStatusResponse | null;
  onRunScan: () => Promise<void>;
  onSimulatePattern: () => Promise<void>;
  isLoading: boolean;
}

export const SelfDiagnosticCard: React.FC<SelfDiagnosticCardProps> = ({
  diagnosticData,
  onRunScan,
  onSimulatePattern,
  isLoading,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  if (!diagnosticData) {
    return null;
  }

  const { health, statusHeadline, totalFilesScanned, activeIssue, historyLogs, autoTriggerCount } =
    diagnosticData;

  const isOptimal = health === "OPTIMAL";
  const isSubOptimal = health === "SUB_OPTIMAL_DETECTED";
  const isHealing = health === "HEALING_IN_PROGRESS";

  return (
    <div
      className={`p-5 rounded-2xl border shadow-xl transition-all duration-300 relative overflow-hidden backdrop-blur-md ${
        isOptimal
          ? "bg-slate-900/80 border-slate-800"
          : isSubOptimal
          ? "bg-gradient-to-b from-rose-950/40 to-slate-900 border-rose-500/50 shadow-rose-950/30"
          : "bg-gradient-to-b from-blue-950/40 to-slate-900 border-blue-500/50 shadow-blue-950/30"
      }`}
    >
      {/* Top ambient glow */}
      <div
        className={`absolute top-0 right-0 w-64 h-32 rounded-full blur-3xl pointer-events-none ${
          isOptimal
            ? "bg-emerald-500/10"
            : isSubOptimal
            ? "bg-rose-500/20"
            : "bg-cyan-500/20"
        }`}
      />

      <div className="relative z-10 space-y-4">
        {/* Top Header: Health Status Badge & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-xl border ${
                isOptimal
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : isSubOptimal
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse"
                  : "bg-blue-500/20 border-blue-500/40 text-blue-400 animate-spin"
              }`}
            >
              {isOptimal ? (
                <ShieldCheck className="w-4 h-4" />
              ) : isSubOptimal ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Autonomous Self-Diagnostic & Healing Loop
                </h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    isOptimal
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : isSubOptimal
                      ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                      : "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  }`}
                >
                  {isOptimal
                    ? "System Optimal"
                    : isSubOptimal
                    ? "Sub-Optimal Pattern Detected"
                    : "Healing In Progress"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{statusHeadline}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 self-start sm:self-auto shrink-0">
            <button
              onClick={onRunScan}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Audit AST code patterns against recent knowledge base additions"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Run Diagnostic Audit</span>
            </button>

            <button
              onClick={onSimulatePattern}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 hover:border-rose-700 text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer"
              title="Simulate detection of a sub-optimal pattern to watch auto-triggered 4-phase upgrade"
            >
              <Bug className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Sub-Optimal Detection</span>
            </button>
          </div>
        </div>

        {/* Flagged Sub-Optimal Pattern Alert Box (Rendered when sub-optimal pattern detected) */}
        {activeIssue && (
          <div className="p-4 rounded-xl bg-slate-950/90 border border-rose-500/40 shadow-lg space-y-3 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono text-xs font-semibold text-rose-300">
                  {activeIssue.component}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {activeIssue.severity} SEVERITY
                </span>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                <Zap className="w-3 h-3 animate-pulse" />
                Auto-Triggered Upgrade Active
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                <span className="text-rose-400">Detected Anti-Pattern:</span>
                <span>{activeIssue.patternName}</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {activeIssue.detectedReason}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center space-x-1.5 text-emerald-400">
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Synthesizing Fix:</span>
                <span className="text-slate-300 font-mono text-[11px] truncate">
                  {activeIssue.modernAlternative}
                </span>
              </div>
              <span className="text-slate-500 text-[10px] font-mono shrink-0">
                Source: {activeIssue.sourceReference}
              </span>
            </div>
          </div>
        )}

        {/* Stats Strip & Log Toggle */}
        <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-4 text-[11px]">
            <span>Files Monitored: <strong className="text-slate-200">{totalFilesScanned}</strong></span>
            <span>Auto-Triggered Heals: <strong className="text-cyan-400">{autoTriggerCount}</strong></span>
          </div>

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-[11px] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <span>Diagnostic Logs ({historyLogs.length})</span>
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expandable Diagnostic History Logs */}
        {showLogs && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-2 max-h-44 overflow-y-auto">
            {historyLogs.map((log) => {
              const isAlert = log.level === "ALERT";
              const isHealed = log.level === "HEALED";
              return (
                <div key={log.id} className="flex items-start space-x-2 leading-relaxed">
                  <span className="text-slate-600 text-[10px] shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      isAlert
                        ? "text-rose-400"
                        : isHealed
                        ? "text-emerald-400"
                        : "text-cyan-400"
                    }`}
                  >
                    [{log.level}]
                  </span>
                  <span className="text-slate-300 break-words flex-1">
                    {log.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
