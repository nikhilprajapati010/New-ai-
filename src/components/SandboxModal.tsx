import React from "react";
import { CheckCircle2, ShieldCheck, Cpu, Clock, X, Layers } from "lucide-react";
import { AutomatedTestResult } from "../types.ts";

interface SandboxModalProps {
  testResults: AutomatedTestResult;
  onClose: () => void;
}

export const SandboxModal: React.FC<SandboxModalProps> = ({ testResults, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                Docker Sandbox Verification
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  100% Pass Rate
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Container ID: {testResults.sandboxId} • {testResults.runtimeVersion}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-3 p-5 bg-slate-950/40 border-b border-slate-800 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center text-slate-400 gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Assertions Passed</span>
            </div>
            <div className="text-lg font-bold text-emerald-300 font-mono">
              {testResults.passedTests} / {testResults.totalTests} (100%)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center text-slate-400 gap-1.5 mb-1">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Container Execution</span>
            </div>
            <div className="text-lg font-bold text-cyan-300 font-mono">
              {testResults.executionTimeMs} ms
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60">
            <div className="flex items-center text-slate-400 gap-1.5 mb-1">
              <Cpu className="w-4 h-4 text-violet-400" />
              <span>Sandbox Isolation</span>
            </div>
            <div className="text-lg font-bold text-violet-300 font-mono">
              Enforced
            </div>
          </div>
        </div>

        {/* Test Suites List */}
        <div className="p-6 max-h-80 overflow-y-auto space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Automated Test Suites (Mocked Docker Harness)</span>
          </div>

          <div className="space-y-2">
            {testResults.suites?.map((suite, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-200">{suite.suite}</div>
                    <div className="text-slate-400 mt-0.5">{suite.name}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 pl-3">
                  <span className="font-mono text-emerald-400 font-medium">{suite.assertions} checks</span>
                  <div className="text-[11px] text-slate-500 font-mono">{suite.durationMs}ms</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/30 text-cyan-200 text-xs leading-relaxed">
            <p className="font-medium text-cyan-300 mb-0.5">Automated Gatekeeper Rule:</p>
            {testResults.summary}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/60 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Close Sandbox Logs
          </button>
        </div>
      </div>
    </div>
  );
};
