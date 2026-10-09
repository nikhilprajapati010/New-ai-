import React, { useState } from "react";
import { Play, Pause, Zap, ShieldCheck, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { UpgradeCycleState } from "../types.ts";

interface UpgradeControllerProps {
  upgradeState: UpgradeCycleState | null;
  isKillSwitchActive: boolean;
  onStartUpgrade: (topic?: string) => Promise<void>;
  onStopUpgrade: () => Promise<void>;
  isLoading: boolean;
}

export const UpgradeController: React.FC<UpgradeControllerProps> = ({
  upgradeState,
  isKillSwitchActive,
  onStartUpgrade,
  onStopUpgrade,
  isLoading,
}) => {
  const [customTopic, setCustomTopic] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const engineStatus = upgradeState?.engineStatus || "IDLE";
  const isRunning = engineStatus === "ACTIVE";
  const isPaused = engineStatus === "PAUSED";

  const handleStart = async () => {
    await onStartUpgrade(customTopic.trim() || undefined);
    setCustomTopic("");
    setShowCustomInput(false);
  };

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Background glowing accent */}
      <div
        className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isRunning
            ? "bg-cyan-500/15 opacity-100"
            : isPaused
            ? "bg-amber-500/15 opacity-80"
            : "bg-slate-700/10 opacity-40"
        }`}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left: Engine Status & Description */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center space-x-2.5">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-lg border ${
                isRunning
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : isPaused
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              <Zap className={`w-4 h-4 ${isRunning ? "animate-pulse" : ""}`} />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center flex-wrap gap-2">
              Autonomous Refactoring Engine
              <span
                className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold tracking-wider border ${
                  isRunning
                    ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 animate-pulse"
                    : isPaused
                    ? "bg-amber-500/20 border-amber-400/40 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {isRunning ? "ACTIVE (Infinite Loop)" : isPaused ? "PAUSED (Safe Standby)" : "IDLE"}
              </span>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                Cycles Completed: <strong className="text-cyan-300">{upgradeState?.totalCyclesCompleted || 0}</strong>
              </span>
            </h3>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Continuously inspects runtime telemetry, queries external technical knowledge (YouTube, GitHub, Google, Wikipedia), passes code through Docker sandbox test suites, and synthesizes Pull Requests for Executive verification.
          </p>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500 pt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              <strong>Safe Control:</strong> Stopping the upgrade pauses refactoring immediately without engaging the Emergency Kill Switch.
            </span>
          </div>
        </div>

        {/* Right: State Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          {/* Start Autonomous Upgrade Button */}
          <button
            onClick={handleStart}
            disabled={isLoading || isRunning || isKillSwitchActive}
            className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-lg cursor-pointer ${
              isRunning
                ? "bg-cyan-950/60 border border-cyan-500/30 text-cyan-400/60 cursor-not-allowed opacity-60"
                : isKillSwitchActive
                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white border border-cyan-400/30 shadow-cyan-500/20 hover:shadow-cyan-500/30 active:scale-[0.98]"
            }`}
            title={
              isKillSwitchActive
                ? "Kill Switch is active. Disengage Kill Switch to run upgrades."
                : isRunning
                ? "Autonomous upgrade is currently in progress."
                : "Initiate autonomous 4-phase upgrade cycle"
            }
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
            ) : (
              <Play className="w-4 h-4 fill-current text-white" />
            )}
            <span>{isPaused ? "Resume Upgrade" : "Start Autonomous Upgrade"}</span>
          </button>

          {/* Stop Upgrade Button */}
          <button
            onClick={onStopUpgrade}
            disabled={isLoading || !isRunning}
            className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border cursor-pointer ${
              isRunning
                ? "bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-600/40 shadow-lg shadow-amber-950/40 hover:border-amber-500/60 active:scale-[0.98]"
                : "bg-slate-900/40 text-slate-500 border-slate-800/80 cursor-not-allowed opacity-50"
            }`}
            title="Safely pauses the active upgrade pipeline without triggering the emergency kill switch"
          >
            <Pause className="w-4 h-4 fill-current text-amber-400" />
            <span>Stop Upgrade</span>
          </button>
        </div>
      </div>

      {/* Optional Target Focus Topic Toggle */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <button
          onClick={() => setShowCustomInput(!showCustomInput)}
          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          <span>{showCustomInput ? "Hide Custom Focus Spec" : "Specify Custom Upgrade Focus (Optional)"}</span>
        </button>

        {showCustomInput && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="WebSocket connection heartbeat, Token bucket rate limiter..."
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 w-full sm:w-72 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        )}

        {isKillSwitchActive && (
          <div className="flex items-center space-x-1 text-[11px] text-rose-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Kill switch active. Upgrade controls suspended.</span>
          </div>
        )}
      </div>
    </div>
  );
};
