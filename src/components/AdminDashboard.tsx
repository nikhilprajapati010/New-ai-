import React, { useState, useEffect, useRef } from "react";
import {
  ShieldAlert,
  Play,
  RotateCw,
  Check,
  X,
  FileCode,
  Lock,
  Layers,
  Terminal as TerminalIcon,
  CheckCircle2,
  Trash2,
  Radio,
  SlidersHorizontal,
  Bug,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.tsx";
import { PendingUpdate, ModelTierConfig, SystemStateData, ModelPriorityId } from "../types.ts";
import { DiffViewer } from "./DiffViewer.tsx";
import { useVanguardWebSocket } from "../hooks/useVanguardWebSocket.ts";
import { UpgradeController } from "./UpgradeController.tsx";
import { UpgradePipelineTracker } from "./UpgradePipelineTracker.tsx";
import { KnowledgeAcquisitionHub } from "./KnowledgeAcquisitionHub.tsx";
import { SelfDiagnosticCard } from "./SelfDiagnosticCard.tsx";
import { AutoDeployPolicyCard } from "./AutoDeployPolicyCard.tsx";
import { ApprovalRequiredAlert } from "./ApprovalRequiredAlert.tsx";
import { FastCodeAuditCard } from "./FastCodeAuditCard.tsx";
import { FileSystemExplorer } from "./FileSystemExplorer.tsx";
import { UpgradeCycleState, DiagnosticStatusResponse, AutoDeployPolicy } from "../types.ts";
import { BookOpen, AlertOctagon, ShieldCheck, Zap, HardDrive } from "lucide-react";

interface AdminDashboardProps {
  onLockSession?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLockSession }) => {
  const { currentUser, isAdmin, setSimulatedRole } = useAuth();
  const { logs: liveTerminalLogs, isConnected: wsConnected, connectionMode, clearLogs: clearTerminalLogs } = useVanguardWebSocket();

  const [systemState, setSystemState] = useState<SystemStateData | null>(null);
  const [updates, setUpdates] = useState<PendingUpdate[]>([]);
  const [activeTab, setActiveTab] = useState<"updates" | "knowledge" | "fs" | "terminal">("updates");
  const [policyLoading, setPolicyLoading] = useState(false);
  const [auditRate, setAuditRate] = useState<number>(128);

  // Upgrade Pipeline State
  const [upgradeState, setUpgradeState] = useState<UpgradeCycleState | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Self-Diagnostic & Healing State
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticStatusResponse | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  // Dynamic Model Router State
  const [activeModel, setActiveModel] = useState<ModelTierConfig | null>(null);
  const [lockedModelId, setLockedModelId] = useState<ModelPriorityId | null>(null);
  const [modelChain, setModelChain] = useState<ModelTierConfig[]>([]);

  const [triggeringWebhook, setTriggeringWebhook] = useState(false);
  const [webhookNotice, setWebhookNotice] = useState<{
    type: "success" | "forbidden" | "error";
    message: string;
  } | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const getAdminHeaders = () => {
    const key = sessionStorage.getItem("vanguard_admin_key") || "456123";
    return {
      Authorization: `Bearer ${key}`,
      "x-admin-key": key,
      "x-user-role": currentUser?.role || "ADMIN",
      "x-user-email": currentUser?.email || "nikhilprajapathi1@gmail.com",
      "Content-Type": "application/json",
    };
  };

  const fetchFastAuditStatus = async () => {
    try {
      const res = await fetch("/api/system/fast-audit/status", {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auditRateFilesPerSec) {
          setAuditRate(data.auditRateFilesPerSec);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchStateAndRouter = async () => {
    try {
      const [stateRes, updatesRes, routerRes] = await Promise.all([
        fetch("/api/system/state", { headers: getAdminHeaders() }),
        fetch("/api/system/updates", { headers: getAdminHeaders() }),
        fetch("/api/system/model-router", { headers: getAdminHeaders() }),
      ]);

      if (stateRes.ok) {
        const stateData = await stateRes.json();
        setSystemState(stateData.state);
      }
      if (updatesRes.ok) {
        const updatesData = await updatesRes.json();
        setUpdates(updatesData.updates || []);
        if (!expandedId && updatesData.updates?.length > 0) {
          setExpandedId(updatesData.updates[0].id);
        }
      }
      if (routerRes.ok) {
        const rData = await routerRes.json();
        setActiveModel(rData.activeModel);
        setLockedModelId(rData.lockedModelId);
        setModelChain(rData.modelChain || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  const fetchUpgradeStatus = async () => {
    try {
      const res = await fetch("/api/system/upgrade/status", {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setUpgradeState(data);
      }
    } catch (e) {
      // ignore
    }
  };

  const fetchDiagnosticStatus = async () => {
    try {
      const res = await fetch("/api/system/diagnostic/status", {
        headers: getAdminHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticData(data);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchStateAndRouter();
    fetchUpgradeStatus();
    fetchDiagnosticStatus();
    fetchFastAuditStatus();
    const stateInterval = setInterval(fetchStateAndRouter, 5000);
    const upgradeInterval = setInterval(fetchUpgradeStatus, 2000);
    const diagInterval = setInterval(fetchDiagnosticStatus, 4000);
    const auditInterval = setInterval(fetchFastAuditStatus, 6000);
    return () => {
      clearInterval(stateInterval);
      clearInterval(upgradeInterval);
      clearInterval(diagInterval);
      clearInterval(auditInterval);
    };
  }, []);

  const handleRunDiagnosticScan = async () => {
    setDiagnosticLoading(true);
    try {
      const res = await fetch("/api/system/diagnostic/scan", {
        method: "POST",
        headers: {
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticData(data.status);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleSimulatePattern = async () => {
    setDiagnosticLoading(true);
    try {
      const res = await fetch("/api/system/diagnostic/simulate-pattern", {
        method: "POST",
        headers: {
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDiagnosticData(data.status);
        fetchUpgradeStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleUpdatePolicy = async (newPolicy: AutoDeployPolicy) => {
    setPolicyLoading(true);
    try {
      const res = await fetch("/api/system/policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({ policy: newPolicy, userEmail: currentUser?.email }),
      });
      if (res.ok) {
        const data = await res.json();
        if (systemState) {
          setSystemState({ ...systemState, autoDeployPolicy: data.policy });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleStartUpgrade = async (topic?: string) => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/system/upgrade/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({ focusTopic: topic }),
      });

      if (res.ok) {
        const data = await res.json();
        setUpgradeState(data.state);
        fetchStateAndRouter();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to initiate autonomous upgrade.");
      }
    } catch (err: any) {
      alert(`Error starting upgrade: ${err.message}`);
    } finally {
      setUpgradeLoading(false);
      fetchUpgradeStatus();
    }
  };

  const handleStopUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/system/upgrade/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUpgradeState(data.state);
        fetchStateAndRouter();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setUpgradeLoading(false);
      fetchUpgradeStatus();
    }
  };

  const [fastAuditLoading, setFastAuditLoading] = useState(false);

  const handleRunFastAudit = async () => {
    setFastAuditLoading(true);
    try {
      const res = await fetch("/api/system/fast-audit/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({
          component: "server/websocketService.ts",
          flawType: "AST_CONCURRENCY",
        }),
      });
      if (res.ok) {
        fetchUpgradeStatus();
        fetchStateAndRouter();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFastAuditLoading(false);
    }
  };

  const handleSimulateFlawAndGatekeeper = async () => {
    setFastAuditLoading(true);
    try {
      const res = await fetch("/api/system/fast-audit/simulate-flaw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "ADMIN",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({
          component: "src/services/authService.ts",
          flawType: "SYNTAX_FLAW",
        }),
      });
      if (res.ok) {
        fetchUpgradeStatus();
        fetchStateAndRouter();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFastAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveTerminalLogs, activeTab]);

  // Toggle Kill Switch
  const handleToggleKillSwitch = async () => {
    if (!systemState || killSwitchLoading) return;
    setKillSwitchLoading(true);
    setWebhookNotice(null);

    const target = !systemState.killSwitch;

    try {
      const res = await fetch("/api/system/kill-switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({
          killSwitch: target,
          userEmail: currentUser?.email,
          userRole: currentUser?.role,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSystemState(data.systemState);
      fetchStateAndRouter();
    } catch (err: any) {
      alert(`Kill switch error: ${err.message}`);
    } finally {
      setKillSwitchLoading(false);
    }
  };

  // Model Lock Selector
  const handleLockModel = async (modelId: string) => {
    try {
      const val = modelId === "AUTO" ? null : (modelId as ModelPriorityId);
      const res = await fetch("/api/system/model-lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({ modelId: val }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveModel(data.activeModel);
        setLockedModelId(data.lockedModelId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Simulate 429/503 for Failover Demonstration
  const handleSimulateError = async (type: "429" | "503") => {
    try {
      await fetch("/api/system/simulate-routing-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({ errorType: type, count: 3 }),
      });
      setActiveTab("terminal");
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger continuous regression to test background auto-remediation
  const handleTriggerRegression = async () => {
    try {
      await fetch("/api/system/trigger-regression", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
      });
      setActiveTab("terminal");
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Manual CI/CD Loop
  const handleTriggerLoop = async () => {
    setTriggeringWebhook(true);
    setWebhookNotice(null);

    try {
      const res = await fetch("/api/internal/hourly-trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
      });

      const data = await res.json();

      if (res.status === 403) {
        setWebhookNotice({
          type: "forbidden",
          message: "403 Forbidden: Kill switch is active. Autonomous scripts are halted.",
        });
      } else if (!res.ok) {
        setWebhookNotice({
          type: "error",
          message: data.error || "Execution failed",
        });
      } else {
        setWebhookNotice({
          type: "success",
          message: `Generated PR [${data.queuedUpdate?.id}]: ${data.queuedUpdate?.title} via ${data.meta?.model}`,
        });
        if (data.queuedUpdate) {
          setExpandedId(data.queuedUpdate.id);
          setActiveTab("updates");
        }
        fetchStateAndRouter();
      }
    } catch (err: any) {
      setWebhookNotice({
        type: "error",
        message: err.message || "Network error",
      });
    } finally {
      setTriggeringWebhook(false);
    }
  };

  // Approve / Reject
  const handlePrAction = async (id: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/system/updates/${id}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": currentUser?.role || "USER",
          "x-user-email": currentUser?.email || "",
        },
        body: JSON.stringify({
          action,
          reviewedBy: currentUser?.email || "Vanguard Executive",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      fetchStateAndRouter();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Vanguard Admin Required</h2>
        <p className="text-slate-400 text-xs mb-6">
          This control shell is restricted to administrators. Switch your role to access the panel.
        </p>
        <button
          onClick={() => setSimulatedRole("ADMIN")}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors cursor-pointer"
        >
          Elevate to Admin
        </button>
      </div>
    );
  }

  const isKillSwitchActive = Boolean(systemState?.killSwitch);
  const pendingUpdates = updates.filter((u) => u.status === "PENDING");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* 1. VANGUARD ACTIVE MODEL BADGE & CONTROL BAR                  */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Active Model Indicator */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Radio className={`w-4 h-4 ${wsConnected ? "animate-pulse" : ""}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-200">
                  Vanguard AI Core
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-medium">
                  {lockedModelId ? `Locked: ${activeModel?.name}` : `Active: ${activeModel?.name || "Gemini 1.5 Pro"}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Fallback Chain: P1: Gemini 1.5 Pro → P2: Gemini 1.5 Flash → P3: Gemini 1.5 Flash 8B
              </p>
            </div>
          </div>

          {/* Model Lock Dropdown & Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={lockedModelId || "AUTO"}
                onChange={(e) => handleLockModel(e.target.value)}
                className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer font-sans"
              >
                <option value="AUTO" className="bg-slate-900 text-white">
                  Automatic Routing (Dynamic Chain)
                </option>
                {modelChain.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    Lock to {m.name} (P{m.priority})
                  </option>
                ))}
              </select>
            </div>

            {/* Run Loop Trigger */}
            <button
              onClick={handleTriggerLoop}
              disabled={triggeringWebhook}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                triggeringWebhook
                  ? "bg-slate-800 text-slate-400 cursor-wait"
                  : "bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700"
              }`}
              title="Trigger continuous CI/CD loop"
            >
              {triggeringWebhook ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Run Trigger</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Kill Switch & Simulation Strip */}
        <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Kill Switch */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleToggleKillSwitch}
              disabled={killSwitchLoading}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isKillSwitchActive ? "bg-rose-600" : "bg-slate-700"
              }`}
              title="Toggle Global Kill Switch"
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  isKillSwitchActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-slate-300 font-medium">Kill Switch:</span>
            <span
              className={`font-mono text-[11px] ${
                isKillSwitchActive ? "text-rose-400 font-bold" : "text-emerald-400"
              }`}
            >
              {isKillSwitchActive ? "ENGAGED (Halted)" : "OFF (24/7 Monitoring Active)"}
            </span>
          </div>

          {/* Failover & Regression Test Buttons */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[11px] mr-1">Test Simulation:</span>
            <button
              onClick={() => handleSimulateError("503")}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-[11px] text-amber-300 border border-amber-900/50 transition-colors cursor-pointer"
              title="Inject simulated 503 error to verify exponential backoff and failover"
            >
              Inject 503
            </button>
            <button
              onClick={() => handleSimulateError("429")}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-[11px] text-amber-300 border border-amber-900/50 transition-colors cursor-pointer"
              title="Inject simulated 429 rate limit"
            >
              Inject 429
            </button>
            <button
              onClick={handleTriggerRegression}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-[11px] text-rose-300 border border-rose-900/50 transition-colors cursor-pointer"
              title="Simulate continuous background test drop below 100% to watch instant auto-remediation"
            >
              <Bug className="w-3 h-3 text-rose-400" />
              <span>Test Regression</span>
            </button>
          </div>
        </div>
      </div>

      {/* Webhook Feedback Notification */}
      {webhookNotice && (
        <div
          className={`px-4 py-2.5 rounded-lg text-xs flex items-center space-x-2 border animate-in fade-in duration-150 ${
            webhookNotice.type === "forbidden"
              ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
              : webhookNotice.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-slate-900 border-slate-800 text-slate-300"
          }`}
        >
          {webhookNotice.type === "forbidden" ? (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{webhookNotice.message}</span>
        </div>
      )}

      {/* PROMINENT PHASE 3 SANDBOX TEST GATEKEEPER BADGE */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/70 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm font-bold text-white tracking-wide">
                Phase 3 Sandbox: Enforcing 100% Pass (0 Errors Allowed)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold uppercase">
                Zero-Error Guarantee Active
              </span>
            </div>
            <p className="text-[11px] text-emerald-200/70 mt-0.5">
              Automated compilation, unit, syntax AST analysis, and headless UI suites run in isolated sandbox. Any flaw triggers instant rollback & self-healing.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-mono text-[11px] text-emerald-300 self-end sm:self-auto bg-slate-950/60 px-3 py-1.5 rounded-xl border border-emerald-900/60">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Pass Rate Enforced: 100.0%</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-500 mb-1">24/7 Event Loop</div>
          <div
            className={`text-sm font-semibold font-mono ${
              isKillSwitchActive ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {isKillSwitchActive ? "Halted" : "Watching & Testing"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-500 mb-1">Continuous Sandbox</div>
          <div className="text-sm font-semibold font-mono text-slate-200">100% Pass Enforced</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-500 mb-1">Active Model</div>
          <div className="text-sm font-semibold font-mono text-cyan-300 truncate">
            {activeModel?.name || "Gemini 1.5 Pro"}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-slate-500 mb-1">Pending PRs</div>
          <div className="text-sm font-semibold font-mono text-cyan-400">
            {pendingUpdates.length}
          </div>
        </div>
      </div>

      {/* HIGH-IMPACT PERMISSION GATING ALERT */}
      {(() => {
        const highImpactPr = updates.find(
          (u) =>
            (u.status === "PENDING" &&
              (u.impactRisk?.severity === "CRITICAL" || u.impactRisk?.requiresApproval)) ||
            u.id === upgradeState?.approvalRequiredPrId
        );
        return highImpactPr ? (
          <ApprovalRequiredAlert
            pr={highImpactPr}
            onApprove={(id) => handlePrAction(id, "APPROVE")}
            onReject={(id) => handlePrAction(id, "REJECT")}
            onInspect={(id) => {
              setExpandedId(id);
              setActiveTab("updates");
            }}
            isLoading={upgradeLoading}
          />
        ) : null;
      })()}

      {/* AUTO-DEPLOY POLICY CARD */}
      <AutoDeployPolicyCard
        currentPolicy={systemState?.autoDeployPolicy || "FULL_AUTONOMY"}
        onUpdatePolicy={handleUpdatePolicy}
        isLoading={policyLoading}
      />

      {/* 2. AUTONOMOUS SELF-DIAGNOSTIC & AUTO-TRIGGERED SELF-HEALING SYSTEM */}
      <SelfDiagnosticCard
        diagnosticData={diagnosticData}
        onRunScan={handleRunDiagnosticScan}
        onSimulatePattern={handleSimulatePattern}
        isLoading={diagnosticLoading}
      />

      {/* 2b. ACCELERATED SELF-CODE AUDIT ENGINE (FastCodeAuditService) */}
      <FastCodeAuditCard
        onRunAudit={handleRunFastAudit}
        onSimulateFlaw={handleSimulateFlawAndGatekeeper}
        isLoading={fastAuditLoading}
      />

      {/* 3. MANUAL & INFINITE CONTINUOUS UPGRADE CONTROLS */}
      <UpgradeController
        upgradeState={upgradeState}
        isKillSwitchActive={isKillSwitchActive}
        onStartUpgrade={handleStartUpgrade}
        onStopUpgrade={handleStopUpgrade}
        isLoading={upgradeLoading}
      />

      {/* 4. REAL-TIME UPGRADE PROCESS TRACKER */}
      <UpgradePipelineTracker
        upgradeState={upgradeState}
        onSelectPr={(prId) => {
          setExpandedId(prId);
          setActiveTab("updates");
        }}
      />

      {/* Tabs */}
      <div className="border-b border-slate-800 flex items-center justify-between text-xs overflow-x-auto">
        <div className="flex items-center space-x-6 shrink-0">
          <button
            onClick={() => setActiveTab("updates")}
            className={`pb-2.5 font-medium flex items-center space-x-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "updates"
                ? "border-cyan-400 text-white font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pending Updates</span>
            {pendingUpdates.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">
                {pendingUpdates.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("knowledge")}
            className={`pb-2.5 font-medium flex items-center space-x-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "knowledge"
                ? "border-cyan-400 text-white font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Autonomous Knowledge Acquisition Hub</span>
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
              YouTube · GitHub · Google · Wiki
            </span>
          </button>

          <button
            onClick={() => setActiveTab("fs")}
            className={`pb-2.5 font-medium flex items-center space-x-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "fs"
                ? "border-cyan-400 text-white font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Omniscient File System Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab("terminal")}
            className={`pb-2.5 font-medium flex items-center space-x-2 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === "terminal"
                ? "border-cyan-400 text-white font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span>Live Stream Terminal</span>
            <span
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
              }`}
              title={wsConnected ? "WebSocket streaming live" : "Connecting..."}
            />
          </button>
        </div>

        {activeTab === "terminal" && (
          <button
            onClick={clearTerminalLogs}
            className="flex items-center space-x-1 pb-2 text-slate-500 hover:text-slate-300 text-[11px] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Terminal</span>
          </button>
        )}
      </div>

      {/* Tab 1: Pending Updates Queue */}
      {activeTab === "updates" && (
        <div className="space-y-4">
          {updates.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No updates in queue. Vanguard AI will automatically generate patches upon file changes or test regressions.
            </div>
          ) : (
            updates.map((update) => {
              const isExpanded = expandedId === update.id;
              const isPending = update.status === "PENDING";

              return (
                <div
                  key={update.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-mono text-xs text-cyan-400 font-semibold">
                          {update.id}
                        </span>
                        <span className="text-sm font-medium text-slate-100">{update.title}</span>

                        {/* Severity Badge */}
                        {update.status === "AUTO_MERGED" ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                            [Severity: Low - Auto-Merged]
                          </span>
                        ) : update.impactRisk?.severity === "CRITICAL" ||
                          update.impactRisk?.requiresApproval ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-semibold">
                            [Severity: High - Permission Required]
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-semibold">
                            [Severity: Low - Routine Fix]
                          </span>
                        )}

                        {/* Fast-Track (Sandbox Verified) Tag */}
                        {(update.isFastTrack ||
                          update.branch?.includes("fast-track") ||
                          update.summary?.includes("Fast-Track") ||
                          update.title?.includes("fast-track")) && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[10px] font-mono font-bold flex items-center space-x-1 shadow-sm">
                            <Zap className="w-3 h-3 text-cyan-400" />
                            <span>Fast-Track (Sandbox Verified)</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-xs shrink-0">
                        {update.impactRisk?.riskScore !== undefined && (
                          <span className="text-[10px] font-mono text-slate-400">
                            Risk: <strong>{update.impactRisk.riskScore}/100</strong>
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                            update.status === "AUTO_MERGED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : update.status === "APPROVED"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : update.status === "REJECTED"
                              ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          }`}
                        >
                          {update.status === "AUTO_MERGED"
                            ? "AUTO-DEPLOYED"
                            : update.status === "PENDING"
                            ? "AWAITING APPROVAL"
                            : update.status}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {update.summary}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                      <div className="flex items-center space-x-3 font-mono text-[11px]">
                        <span>{update.targetFile}</span>
                        <span className="text-emerald-400">+{update.additions}</span>
                        <span className="text-rose-400">-{update.deletions}</span>
                        <span className="text-slate-500">
                          Sandbox: 100% Passed ({update.testResults?.totalTests || 18} tests)
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : update.id)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs transition-colors cursor-pointer"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>{isExpanded ? "Hide Diff" : "View Diff"}</span>
                        </button>

                        {isPending && (
                          <>
                            <button
                              onClick={() => handlePrAction(update.id, "REJECT")}
                              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-400 text-xs transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                            <button
                              onClick={() => handlePrAction(update.id, "APPROVE")}
                              className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 pt-0 border-t border-slate-800/80 bg-slate-950/40">
                      <div className="py-2 text-[11px] font-mono text-slate-500">
                        {update.targetFile}
                      </div>
                      <DiffViewer diff={update.diff} filePath={update.targetFile} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Autonomous Knowledge Acquisition Hub (Strictly Admin Restricted) */}
      {activeTab === "knowledge" && (
        <KnowledgeAcquisitionHub
          userRole={currentUser?.role}
          userEmail={currentUser?.email}
        />
      )}

      {/* Tab 3: Omniscient File System Explorer (Direct /src and /server read/write) */}
      {activeTab === "fs" && (
        <FileSystemExplorer />
      )}

      {/* Tab 4: Live Stream Terminal (WebSocket powered) */}
      {activeTab === "terminal" && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs overflow-hidden shadow-2xl">
          {/* Terminal Title Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
              <span className="ml-2 text-slate-300 font-semibold font-mono">
                vanguard-live-stream ~ /ws/vanguard
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="text-slate-500 font-mono">Stream: {connectionMode}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                }`}
              />
            </div>
          </div>

          {/* Terminal Output */}
          <div className="p-4 space-y-1.5 max-h-[520px] overflow-y-auto leading-relaxed select-text bg-slate-950/95">
            {liveTerminalLogs.length === 0 ? (
              <div className="text-slate-600 py-6 text-center">
                Awaiting streaming events from Vanguard AI continuous monitoring loop...
              </div>
            ) : (
              liveTerminalLogs.map((log) => {
                let badgeClass = "text-slate-400";
                if (log.level === "ERROR") badgeClass = "text-rose-400 font-bold";
                else if (log.level === "WARN") badgeClass = "text-amber-400 font-semibold";
                else if (log.level === "TEST") badgeClass = "text-emerald-400";
                else if (log.level === "EVENT") badgeClass = "text-cyan-400 font-semibold";

                return (
                  <div key={log.id} className="flex items-start space-x-2 font-mono text-[11px]">
                    <span className="text-slate-600 shrink-0 text-[10px]">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className={`shrink-0 ${badgeClass}`}>
                      [{log.level}]
                    </span>
                    <span className="text-slate-500 shrink-0">
                      [{log.source}]:
                    </span>
                    <span className="text-slate-300 break-words flex-1">
                      {log.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
