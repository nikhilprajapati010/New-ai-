import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Code2,
  Search,
  Cpu,
  GitPullRequest,
  ChevronDown,
  ChevronUp,
  Terminal,
  ExternalLink,
  PauseCircle,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Youtube,
  Github,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { UpgradeCycleState, LearningSourceId } from "../types.ts";

interface UpgradePipelineTrackerProps {
  upgradeState: UpgradeCycleState | null;
  onSelectPr?: (prId: string) => void;
}

export const UpgradePipelineTracker: React.FC<UpgradePipelineTrackerProps> = ({
  upgradeState,
  onSelectPr,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  if (!upgradeState) {
    return null;
  }

  const {
    progress,
    currentPhase,
    phases,
    statusMessage,
    streamingLogs,
    engineStatus,
    generatedPrId,
    activeLearningItem,
    isFastTrack,
    fastTrackAudit,
  } = upgradeState;

  const isRunning = engineStatus === "ACTIVE";
  const isPaused = engineStatus === "PAUSED";
  const isCompleted = engineStatus === "COMPLETED";

  const getSourceIcon = (src?: LearningSourceId) => {
    switch (src) {
      case "youtube":
        return <Youtube className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case "github":
        return <Github className="w-3.5 h-3.5 text-slate-200 shrink-0" />;
      case "google":
        return <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case "wikipedia":
        return <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  const phaseIcons = [
    <Code2 className="w-4 h-4" key="1" />,
    <Search className="w-4 h-4" key="2" />,
    <Cpu className="w-4 h-4" key="3" />,
    <GitPullRequest className="w-4 h-4" key="4" />,
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
      {/* Header & Gatekeeper Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Activity className={`w-4 h-4 ${isRunning ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-white tracking-wide">
                Active Upgrade Pipeline
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-medium">
                Cycle #{upgradeState.totalCyclesCompleted ? upgradeState.totalCyclesCompleted + 1 : 1}
              </span>
              {isFastTrack && (
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center space-x-1 animate-pulse">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Fast-Track Audit Active (Bypassed Phase 2)</span>
                </span>
              )}
              {upgradeState.isInfiniteLoopActive && isRunning && !isFastTrack && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium animate-pulse">
                  Infinite Auto-Loop Active
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Autonomous multi-phase refactoring, live knowledge acquisition, and sandbox verification
            </p>
          </div>
        </div>

        {/* Phase 3 Sandbox Test Gatekeeper Badge */}
        <div className="flex items-center space-x-3 self-start lg:self-auto">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-sm text-xs font-mono font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold">Phase 3 Sandbox: Enforcing 100% Pass (0 Errors Allowed)</span>
          </div>

          <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-mono">Progress</div>
              <div className="text-sm font-bold font-mono text-cyan-300">{progress}%</div>
            </div>
            <div className="w-20 sm:w-28 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isPaused
                    ? "bg-amber-400"
                    : isCompleted
                    ? "bg-emerald-400"
                    : "bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 animate-pulse"
                }`}
                style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Step Pipeline Phase Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {phases.map((phase, idx) => {
          const isPhaseActive = isRunning && currentPhase === phase.phaseNumber;
          const isPhaseCompleted = phase.status === "COMPLETED";
          const isPhasePaused = isPaused && currentPhase === phase.phaseNumber;
          const isPhaseBypassed = phase.status === "BYPASSED";

          return (
            <div
              key={phase.phaseNumber}
              className={`p-3.5 rounded-xl border transition-all duration-300 relative overflow-hidden ${
                isPhaseActive
                  ? "bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/20"
                  : isPhaseBypassed
                  ? "bg-amber-950/20 border-amber-500/30 text-amber-200"
                  : isPhaseCompleted
                  ? "bg-emerald-950/20 border-emerald-500/30 text-slate-300"
                  : isPhasePaused
                  ? "bg-amber-950/20 border-amber-500/30"
                  : "bg-slate-950/50 border-slate-800/80 text-slate-500"
              }`}
            >
              {isPhaseActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
              )}

              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                    isPhaseActive
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : isPhaseBypassed
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : isPhaseCompleted
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : isPhasePaused
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700/50"
                  }`}
                >
                  Phase {phase.phaseNumber}
                </span>

                <div className="flex items-center">
                  {isPhaseBypassed ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      BYPASSED
                    </span>
                  ) : isPhaseCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isPhaseActive ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  ) : isPhasePaused ? (
                    <PauseCircle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 mb-1.5">
                <div
                  className={`p-1 rounded-md shrink-0 ${
                    isPhaseActive
                      ? "bg-cyan-500/20 text-cyan-300"
                      : isPhaseBypassed
                      ? "bg-amber-500/20 text-amber-400"
                      : isPhaseCompleted
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {phaseIcons[idx]}
                </div>
                <h4
                  className={`text-xs font-semibold leading-snug truncate ${
                    isPhaseActive
                      ? "text-cyan-200"
                      : isPhaseBypassed
                      ? "text-amber-200"
                      : isPhaseCompleted
                      ? "text-slate-200"
                      : "text-slate-400"
                  }`}
                >
                  {phase.name}
                </h4>
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {isPhaseBypassed && phase.bypassReason ? phase.bypassReason : phase.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* LIVE ACTIVE LEARNING MONITOR (Phase 2 Exact Item Visibility) */}
      {activeLearningItem && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-900/40 relative overflow-hidden space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[10px] font-mono text-indigo-300 font-semibold uppercase">
                {getSourceIcon(activeLearningItem.source)}
                <span>Live Active Learning Monitor</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Category: <strong className="text-slate-200">{activeLearningItem.category}</strong>
              </span>
            </div>

            {/* Character & Token Real-time Progress Bar */}
            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="text-cyan-400 font-semibold">
                Tokens: {activeLearningItem.currentTokens} / {activeLearningItem.totalTokens}
              </span>
              <span className="text-slate-500">
                ({activeLearningItem.currentCharacters.toLocaleString()} / {activeLearningItem.totalCharacters.toLocaleString()} chars)
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                {Math.round((activeLearningItem.currentCharacters / activeLearningItem.totalCharacters) * 100)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-slate-200 truncate flex items-center space-x-2">
              <span>{activeLearningItem.title}</span>
              {activeLearningItem.url && (
                <a
                  href={activeLearningItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-0.5 text-[11px]"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="w-full sm:w-48 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-indigo-900/60 shrink-0">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((activeLearningItem.currentCharacters / activeLearningItem.totalCharacters) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300 truncate">
            {activeLearningItem.streamingSnippet}
          </div>
        </div>
      )}

      {/* Streaming Status Message & Ticker */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5 flex-1 min-w-0">
          <div className="flex items-center space-x-1.5 shrink-0 font-mono text-[11px] text-slate-400">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? "bg-cyan-400 animate-pulse"
                  : isPaused
                  ? "bg-amber-400"
                  : isCompleted
                  ? "bg-emerald-400"
                  : "bg-slate-600"
              }`}
            />
            <span className="font-semibold text-slate-300">Live Status:</span>
          </div>
          <span className="text-slate-200 truncate font-mono text-[11px]">{statusMessage}</span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {generatedPrId && onSelectPr && (
            <button
              onClick={() => onSelectPr(generatedPrId)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Inspect {generatedPrId.toUpperCase()}</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </button>
          )}

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <Terminal className="w-3 h-3 text-slate-400" />
            <span>Cycle Stream Logs</span>
            {showLogs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Streaming Logs Drawer */}
      {showLogs && (
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1.5 max-h-48 overflow-y-auto">
          <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-1">
            Real-time Pipeline Stream (Active Cycle: {upgradeState.id})
          </div>
          {streamingLogs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed ${
                i === 0 ? "text-cyan-300 font-semibold" : "text-slate-400"
              }`}
            >
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
