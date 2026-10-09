import React, { useState, useEffect } from "react";
import { Folder, FileText, Search, RefreshCw, Save, Code, CheckCircle2, ChevronRight, ChevronDown, Layers, FileCode, HardDrive } from "lucide-react";
import { FileNode, FileSystemStats } from "../types.ts";

export const FileSystemExplorer: React.FC = () => {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [stats, setStats] = useState<FileSystemStats | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>("src/App.tsx");
  const [fileContent, setFileContent] = useState<string>("");
  const [fileDetails, setFileDetails] = useState<{ lines: number; size: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; snippet: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    server: true,
    "src/components": true,
  });

  const getAdminHeaders = () => {
    const key = sessionStorage.getItem("vanguard_admin_key") || "456123";
    return {
      Authorization: `Bearer ${key}`,
      "x-admin-key": key,
      "Content-Type": "application/json",
    };
  };

  const fetchTreeAndStats = async () => {
    setIsLoading(true);
    try {
      const [treeRes, statsRes] = await Promise.all([
        fetch("/api/system/fs/tree?root=src", { headers: getAdminHeaders() }),
        fetch("/api/system/fs/stats", { headers: getAdminHeaders() }),
      ]);

      if (treeRes.ok) {
        const tData = await treeRes.json();
        setTree(tData.tree);
      }
      if (statsRes.ok) {
        const sData = await statsRes.json();
        setStats(sData.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath);
    try {
      const res = await fetch(`/api/system/fs/file?path=${encodeURIComponent(filePath)}`, {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setFileContent(data.file.content);
        setFileDetails({ lines: data.file.lines, size: data.file.size });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/system/fs/file", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          path: selectedFile,
          content: fileContent,
        }),
      });
      if (res.ok) {
        setNotice(`Successfully saved ${selectedFile}`);
        setTimeout(() => setNotice(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`/api/system/fs/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.matches || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTreeAndStats();
    loadFile("src/App.tsx");
  }, []);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (node: FileNode) => {
    if (node.type === "directory") {
      const isExpanded = expandedFolders[node.path] ?? false;
      return (
        <div key={node.path} className="text-xs font-mono">
          <div
            onClick={() => toggleFolder(node.path)}
            className="flex items-center space-x-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{node.name}</span>
          </div>

          {isExpanded && node.children && (
            <div className="pl-4 border-l border-slate-800/80 ml-2 space-y-0.5">
              {node.children.map((child) => renderTree(child))}
            </div>
          )}
        </div>
      );
    }

    const isSelected = selectedFile === node.path;
    return (
      <div
        key={node.path}
        onClick={() => loadFile(node.path)}
        className={`flex items-center space-x-1.5 py-1 px-1.5 rounded text-xs font-mono cursor-pointer transition-colors ${
          isSelected
            ? "bg-cyan-500/20 text-cyan-300 font-semibold border-l-2 border-cyan-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
        }`}
      >
        <FileCode className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.lines && (
          <span className="text-[10px] text-slate-600 ml-auto">{node.lines}L</span>
        )}
      </div>
    );
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Omniscient File System Access
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold uppercase">
                Recursive Read/Write
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Direct access across <code className="text-slate-300">/src</code> and <code className="text-slate-300">/server</code> directories with automated backup snapshots.
            </p>
          </div>
        </div>

        <button
          onClick={fetchTreeAndStats}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Codebase</span>
        </button>
      </div>

      {/* Codebase Metrics */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">TOTAL FILES</div>
            <div className="text-base font-bold text-cyan-300">{stats.totalFiles}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">LINES OF CODE</div>
            <div className="text-base font-bold text-indigo-300">{stats.totalLinesOfCode.toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">TYPESCRIPT</div>
            <div className="text-base font-bold text-blue-300">{stats.typescriptFiles}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">REACT UI</div>
            <div className="text-base font-bold text-purple-300">{stats.reactComponents}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px]">SERVER SERVICES</div>
            <div className="text-base font-bold text-emerald-300">{stats.serverServices}</div>
          </div>
        </div>
      )}

      {notice && (
        <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center space-x-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Explorer Workspace: File Tree on left, Code Viewer/Editor on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Search & Tree */}
        <div className="lg:col-span-4 bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-3">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code symbol..."
              className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </form>

          {searchResults.length > 0 && (
            <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-800 max-h-36 overflow-y-auto space-y-1 text-xs font-mono">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Search Results ({searchResults.length})
              </div>
              {searchResults.slice(0, 15).map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => loadFile(m.path)}
                  className="p-1 rounded hover:bg-slate-800 cursor-pointer truncate text-[11px]"
                >
                  <span className="text-cyan-400">{m.path}:{m.line}</span>{" "}
                  <span className="text-slate-400">{m.snippet}</span>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
            {tree ? renderTree(tree) : <div className="text-xs text-slate-500 font-mono">Loading tree...</div>}
          </div>
        </div>

        {/* Right: Code Viewer / Safe Editor */}
        <div className="lg:col-span-8 bg-slate-950 rounded-xl border border-slate-800 p-3 flex flex-col space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-850 text-xs font-mono">
            <div className="flex items-center space-x-2 truncate">
              <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-200 truncate">{selectedFile || "Select a file"}</span>
              {fileDetails && (
                <span className="text-slate-500 text-[11px]">
                  ({fileDetails.lines} lines, {fileDetails.size} bytes)
                </span>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving || !selectedFile}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>

          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            spellCheck={false}
            className="w-full flex-1 h-96 p-3 rounded-lg bg-slate-900 border border-slate-850 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed resize-none selection:bg-cyan-500/30"
          />
        </div>
      </div>
    </div>
  );
};
