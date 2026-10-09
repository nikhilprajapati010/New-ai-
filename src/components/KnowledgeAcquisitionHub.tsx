import React, { useState, useEffect } from "react";
import {
  Globe,
  Github,
  BookOpen,
  Youtube,
  Search,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Database,
  CheckCircle2,
  Sliders,
  Radio,
  FileCode,
  GitPullRequest,
  Tv,
  FileText,
  Activity,
} from "lucide-react";
import {
  LearningSourceConfig,
  KnowledgeArtifact,
  LearningSourceId,
  KnowledgeMetrics,
  KnowledgeStreamTickerItem,
  ActiveLearningItem,
} from "../types.ts";
import { sanitizeClientInput } from "../utils/sanitize.ts";

interface KnowledgeAcquisitionHubProps {
  userRole?: string;
  userEmail?: string;
}

export const KnowledgeAcquisitionHub: React.FC<KnowledgeAcquisitionHubProps> = ({
  userRole,
  userEmail,
}) => {
  const [sources, setSources] = useState<LearningSourceConfig[]>([]);
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [activeItem, setActiveItem] = useState<ActiveLearningItem | null>(null);
  const [metrics, setMetrics] = useState<KnowledgeMetrics>({
    repositoriesScanned: 1420,
    prsParsed: 864,
    transcriptsIngested: 540,
    pagesScraped: 3890,
    totalKnowledgeNodes: 6714,
    lastActiveObserverTimestamp: new Date().toISOString(),
  });
  const [ticker, setTicker] = useState<KnowledgeStreamTickerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const getAdminHeaders = () => {
    const key = sessionStorage.getItem("vanguard_admin_key") || "456123";
    return {
      Authorization: `Bearer ${key}`,
      "x-admin-key": key,
      "x-user-role": userRole || "ADMIN",
      "x-user-email": userEmail || "",
      "Content-Type": "application/json",
    };
  };

  // Fetch sources, metrics, and ticker
  const fetchData = async () => {
    try {
      const headers = getAdminHeaders();

      const [sourcesRes, artifactsRes, metricsRes, tickerRes, activeItemRes] = await Promise.all([
        fetch("/api/system/learning/sources", { headers }),
        fetch("/api/system/learning/artifacts?limit=25", { headers }),
        fetch("/api/system/learning/metrics", { headers }),
        fetch("/api/system/learning/ticker", { headers }),
        fetch("/api/system/learning/active-item", { headers }),
      ]);

      if (sourcesRes.ok) {
        const sData = await sourcesRes.json();
        setSources(sData.sources || []);
      }

      if (artifactsRes.ok) {
        const aData = await artifactsRes.json();
        setArtifacts(aData.artifacts || []);
      }

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        if (mData.metrics) setMetrics(mData.metrics);
      }

      if (tickerRes.ok) {
        const tData = await tickerRes.json();
        if (tData.ticker) setTicker(tData.ticker);
      }

      if (activeItemRes.ok) {
        const aiData = await activeItemRes.json();
        if (aiData.activeLearningItem) setActiveItem(aiData.activeLearningItem);
      }
    } catch (e) {
      console.error("Failed to load learning engine data:", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Toggle individual learning source
  const handleToggleSource = async (sourceId: LearningSourceId, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/system/learning/sources/${sourceId}/toggle`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, enabled: !currentEnabled } : s))
        );
        setNotice(`Learning Source '${sourceId.toUpperCase()}' ${!currentEnabled ? "enabled" : "paused"}.`);
        setTimeout(() => setNotice(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run On-Demand Live Knowledge Research
  const handleResearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTopic = sanitizeClientInput(searchQuery.trim(), 200);
    if (!cleanTopic || isSearching) return;

    setIsSearching(true);
    setNotice(null);

    try {
      const res = await fetch("/api/system/learning/research", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ topic: cleanTopic }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotice(`Acquired ${data.acquiredCount} new knowledge artifacts for "${cleanTopic}"!`);
        setSearchQuery("");
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice(`Research failed: ${err.message || err.error || "Request error"}`);
      }
    } catch (err: any) {
      setNotice(`Error: ${err.message}`);
    } finally {
      setIsSearching(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  const getSourceIcon = (id: LearningSourceId) => {
    switch (id) {
      case "github":
        return <Github className="w-4 h-4 text-purple-400" />;
      case "google":
        return <Globe className="w-4 h-4 text-blue-400" />;
      case "wikipedia":
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case "youtube":
        return <Youtube className="w-4 h-4 text-rose-400" />;
    }
  };

  const getSourceBadgeColor = (id: LearningSourceId) => {
    switch (id) {
      case "github":
        return "bg-purple-500/15 border-purple-500/30 text-purple-300";
      case "google":
        return "bg-blue-500/15 border-blue-500/30 text-blue-300";
      case "wikipedia":
        return "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
      case "youtube":
        return "bg-rose-500/15 border-rose-500/30 text-rose-300";
    }
  };

  const filteredArtifacts =
    activeFilter === "all"
      ? artifacts
      : artifacts.filter((a) => a.source === activeFilter);

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              Autonomous Knowledge Acquisition Hub
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                Admin Exclusive
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                24/7 Passive Observer Active
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Infinite background scraper cross-referencing AI concepts, code patches, conference transcripts, and algorithmic logic from YouTube, GitHub, Google, and Wikipedia.
          </p>
        </div>

        {/* Total Indexed Nodes */}
        <div className="flex items-center space-x-2 self-start sm:self-auto bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
          <span className="text-slate-400">Total Indexed Nodes:</span>
          <span className="text-cyan-300 font-bold text-sm">
            {metrics.totalKnowledgeNodes.toLocaleString()}
          </span>
        </div>
      </div>

      {/* LIVE ACTIVE LEARNING MONITOR (Exact Item Visibility) */}
      {activeItem && (
        <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 shadow-lg relative overflow-hidden space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold uppercase ${getSourceBadgeColor(activeItem.source)}`}>
                {getSourceIcon(activeItem.source)}
                <span>Live Active Learning Monitor</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Source: <strong className="text-slate-200 uppercase">{activeItem.source}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2 font-mono text-[11px]">
              <span className="text-cyan-400 font-semibold">
                Tokens: {activeItem.currentTokens.toLocaleString()} / {activeItem.totalTokens.toLocaleString()}
              </span>
              <span className="text-slate-500">
                ({activeItem.currentCharacters.toLocaleString()} / {activeItem.totalCharacters.toLocaleString()} chars)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                {Math.round((activeItem.currentCharacters / activeItem.totalCharacters) * 100)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200 truncate">
              <span>{activeItem.title}</span>
              {activeItem.url && (
                <a
                  href={activeItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-0.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="w-full sm:w-64 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 shrink-0">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((activeItem.currentCharacters / activeItem.totalCharacters) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{activeItem.streamingSnippet}</span>
          </div>
        </div>
      )}

      {/* 1. MULTI-SOURCE METRIC BREAKDOWN GRID */}
      <div>
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold mb-2.5 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real-Time Multi-Source Ingestion Metrics</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-500/20 shadow-sm flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Github className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Repositories Scanned</div>
              <div className="text-base font-bold font-mono text-purple-300">
                {metrics.repositoriesScanned.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/20 shadow-sm flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">PRs Parsed</div>
              <div className="text-base font-bold font-mono text-indigo-300">
                {metrics.prsParsed.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-rose-500/20 shadow-sm flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Tv className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Transcripts Ingested</div>
              <div className="text-base font-bold font-mono text-rose-300">
                {metrics.transcriptsIngested.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-blue-500/20 shadow-sm flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Pages Scraped</div>
              <div className="text-base font-bold font-mono text-blue-300">
                {metrics.pagesScraped.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. LIVE STREAMING ACTIVITY TICKER */}
      <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center space-x-2 text-cyan-300 font-semibold">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>24/7 Passive Observer Live Stream Ticker</span>
          </div>
          <span className="text-slate-500 text-[10px]">Auto-refreshing stream</span>
        </div>

        <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1 text-xs font-mono">
          {ticker.length === 0 ? (
            <div className="text-slate-500 text-xs py-2">Listening for external knowledge ingestion events...</div>
          ) : (
            ticker.map((item, i) => (
              <div
                key={item.id}
                className={`p-1.5 rounded-lg flex items-center justify-between gap-2 border text-[11px] ${
                  i === 0
                    ? "bg-cyan-950/30 border-cyan-500/30 text-cyan-200"
                    : "bg-slate-900/40 border-slate-800/60 text-slate-400"
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded border font-semibold shrink-0 ${getSourceBadgeColor(
                      item.source
                    )}`}
                  >
                    {item.source}
                  </span>
                  <span className="font-semibold text-slate-200 truncate">{item.action}:</span>
                  <span className="truncate">{item.details}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0 hidden sm:inline">
                  [{item.targetFramework}]
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. FOUR INTERACTIVE SOURCE CONFIGURATION CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {sources.map((source) => (
          <div
            key={source.id}
            className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
              source.enabled
                ? "bg-slate-950/80 border-slate-800 hover:border-slate-700 shadow-md"
                : "bg-slate-950/40 border-slate-800/40 opacity-60"
            }`}
          >
            <div>
              {/* Top row: Icon + Toggle */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                    {getSourceIcon(source.id)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">{source.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      {source.category}
                    </span>
                  </div>
                </div>

                {/* Switch Toggle */}
                <button
                  onClick={() => handleToggleSource(source.id, source.enabled)}
                  className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    source.enabled ? "bg-cyan-500" : "bg-slate-800"
                  }`}
                  title={`${source.enabled ? "Disable" : "Enable"} ${source.name}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      source.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                {source.description}
              </p>
            </div>

            {/* Bottom: Indexed Count & Status */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center space-x-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    source.enabled ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                  }`}
                />
                <span>{source.enabled ? "SYNCED" : "PAUSED"}</span>
              </span>
              <span>{source.itemsIndexed.toLocaleString()} items</span>
            </div>
          </div>
        ))}
      </div>

      {/* 4. ON-DEMAND AUTONOMOUS RESEARCH BAR */}
      <form onSubmit={handleResearch} className="space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search autonomous learning engine ('Token bucket rate limiter', 'WebSocket heartbeat RFC', 'Circuit breaker pattern')..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer shrink-0 ${
              isSearching || !searchQuery.trim()
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20 active:scale-[0.98]"
            }`}
          >
            {isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            )}
            <span>{isSearching ? "Ingesting Knowledge..." : "Ingest Knowledge"}</span>
          </button>
        </div>

        {notice && (
          <div className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
      </form>

      {/* 5. FILTER TABS & ACQUIRED KNOWLEDGE FEED */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] text-slate-500 mr-2 flex items-center">
              <Sliders className="w-3 h-3 mr-1" /> Filter:
            </span>
            {["all", "github", "google", "wikipedia", "youtube"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize transition-colors cursor-pointer ${
                  activeFilter === tab
                    ? "bg-slate-800 text-cyan-300 font-semibold border border-slate-700"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-500">
            Showing {filteredArtifacts.length} recent artifacts
          </span>
        </div>

        {/* Artifacts Feed */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
          {filteredArtifacts.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-2 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border uppercase tracking-wider flex items-center gap-1 ${getSourceBadgeColor(
                      item.source
                    )}`}
                  >
                    {getSourceIcon(item.source)}
                    <span>{item.source}</span>
                  </span>

                  <span className="text-[10px] font-mono text-slate-400">
                    Relevance: <strong className="text-cyan-300">{item.relevanceScore}%</strong>
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                  {item.title}
                </h4>

                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                  {item.snippet}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center space-x-1 truncate mr-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 shrink-0"
                >
                  <span>Source</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
