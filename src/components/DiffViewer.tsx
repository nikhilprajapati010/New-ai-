import React, { useState } from "react";
import { Copy, Check, FileCode } from "lucide-react";

interface DiffViewerProps {
  diff: string;
  filePath?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, filePath }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = diff.split("\n");

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/80 overflow-hidden text-xs font-mono shadow-inner">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-300">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">{filePath || "patch.diff"}</span>
          <span className="text-[10px] text-slate-500 font-sans uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800">
            Unified Git Diff
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Copy raw diff"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code diff lines */}
      <div className="overflow-x-auto max-h-80 p-2 font-mono leading-relaxed select-text">
        {lines.map((line, idx) => {
          let lineClass = "text-slate-400 hover:bg-slate-900/50";
          let prefixBg = "";

          if (line.startsWith("+++") || line.startsWith("---")) {
            lineClass = "text-cyan-400 font-bold bg-cyan-950/20";
          } else if (line.startsWith("@@")) {
            lineClass = "text-amber-400 bg-amber-950/20 font-semibold";
          } else if (line.startsWith("+")) {
            lineClass = "text-emerald-300 bg-emerald-950/30";
            prefixBg = "text-emerald-400 font-bold";
          } else if (line.startsWith("-")) {
            lineClass = "text-rose-300 bg-rose-950/30";
            prefixBg = "text-rose-400 font-bold";
          }

          return (
            <div key={idx} className={`flex items-start px-2 py-0.5 rounded-sm ${lineClass}`}>
              <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-3 text-[11px]">
                {idx + 1}
              </span>
              <span className="shrink-0 w-4 select-none font-bold">
                {line.startsWith("+") && !line.startsWith("+++") ? "+" : ""}
                {line.startsWith("-") && !line.startsWith("---") ? "-" : ""}
              </span>
              <span className="whitespace-pre flex-1">
                {line.startsWith("+") || line.startsWith("-") ? line.substring(1) : line}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
