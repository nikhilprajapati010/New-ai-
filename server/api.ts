import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { systemState } from "./state.js";
import { handleUserChat, streamUserChat } from "./userService.js";
import { analyzeLogsAndGenerateUpdate } from "./systemDevService.js";
import { runAutomatedTests } from "./sandbox.js";
import { dynamicModelRouter, MODEL_CHAIN, ModelPriorityId } from "./modelRouter.js";
import { vanguardContinuousLoop } from "./continuousLoop.js";
import { vanguardWebSocket } from "./websocketService.js";

export const apiApp = express();

apiApp.use(cors());
apiApp.use(express.json());

// Helper for RBAC check
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = req.headers["x-user-role"] || req.body?.userRole;
  const email = (req.headers["x-user-email"] as string) || req.body?.userEmail || "";

  const isAdminEmail = email.toLowerCase() === "nikhilprajapathi1@gmail.com";
  const isAdminRole = role === "ADMIN";

  if (isAdminRole || isAdminEmail) {
    return next();
  }

  return res.status(403).json({
    error: "Forbidden: Access restricted to authorized Vanguard AI Executive Administrators.",
    requiredRole: "ADMIN",
    currentRole: role || "ANONYMOUS",
  });
}

// --------------------------------------------------------------------------
// 1. User Mode Chat API (UserService with Dynamic Model Router & SSE Streaming)
// --------------------------------------------------------------------------
apiApp.post("/api/chat/stream", async (req: Request, res: Response) => {
  try {
    const { history = [], message, replayToken } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Field 'message' is required." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const response = await streamUserChat(
      history,
      message,
      (chunk: string) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
      replayToken
    );

    systemState.recordTokenUsage(
      response.tokensUsed.promptTokens,
      response.tokensUsed.completionTokens
    );

    vanguardWebSocket.broadcastLog({
      level: "INFO",
      source: "user-chat",
      message: `Stream completed via [${response.model}] (${response.tokensUsed.totalTokens} tokens, failover: ${response.failoverOccurred}).`,
    });

    res.write(`data: ${JSON.stringify({ done: true, meta: response })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error("Stream Chat API error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "Streaming error" })}\n\n`);
    res.end();
  }
});

apiApp.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { history = [], message, replayToken } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Field 'message' is required." });
    }

    const response = await handleUserChat(history, message, replayToken);

    systemState.recordTokenUsage(
      response.tokensUsed.promptTokens,
      response.tokensUsed.completionTokens
    );

    vanguardWebSocket.broadcastLog({
      level: "INFO",
      source: "user-chat",
      message: `User query resolved by [${response.model}] (attempts: ${response.attempts}, failover: ${response.failoverOccurred}).`,
    });

    res.json(response);
  } catch (error: any) {
    console.error("Chat API error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// --------------------------------------------------------------------------
// 2. Continuous CI/CD Webhook / Manual Trigger
// --------------------------------------------------------------------------
apiApp.post("/api/internal/hourly-trigger", async (req: Request, res: Response) => {
  try {
    if (systemState.getKillSwitch()) {
      vanguardWebSocket.broadcastLog({
        level: "WARN",
        source: "ci-cd-webhook",
        message: "Trigger rejected: Global kill switch is ACTIVE. Autonomous scripts halted.",
      });
      return res.status(403).json({
        error: "Kill switch is active. Autonomous scripts are halted.",
        killSwitch: true,
        timestamp: new Date().toISOString(),
      });
    }

    const recentLogs = systemState.getTelemetryLogs(12);
    const devServiceOutput = await analyzeLogsAndGenerateUpdate(recentLogs);
    const { update, tokensUsed, model, attempts, failoverOccurred } = devServiceOutput;

    systemState.recordTokenUsage(tokensUsed.promptTokens, tokensUsed.completionTokens);

    const testResults = await runAutomatedTests(update.diff);

    const queuedUpdate = systemState.addPendingUpdate({
      title: update.title,
      branch: update.branch,
      targetFile: update.targetFile,
      summary: update.summary,
      diff: update.diff,
      additions: update.additions,
      deletions: update.deletions,
      testResults,
    });

    vanguardWebSocket.broadcastLog({
      level: "EVENT",
      source: "ci-cd-webhook",
      message: `Autonomous PR queued: [${queuedUpdate.id}] "${queuedUpdate.title}" generated by ${model}.`,
    });

    res.json({
      success: true,
      message: "Continuous CI/CD loop synthesized and sandbox-tested update.",
      queuedUpdate,
      testResults,
      meta: {
        model,
        attempts,
        failoverOccurred,
        tokensUsed,
        triggerTimestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Trigger error:", error);
    vanguardWebSocket.broadcastLog({
      level: "ERROR",
      source: "ci-cd-webhook",
      message: `Trigger failure: ${error.message || "Unknown error"}`,
    });
    res.status(500).json({ error: error.message || "Failed to execute trigger." });
  }
});

// --------------------------------------------------------------------------
// 3. Dynamic Model Router State & Control APIs
// --------------------------------------------------------------------------
apiApp.get("/api/system/model-router", (_req: Request, res: Response) => {
  const activeModel = dynamicModelRouter.getActiveModel();
  const lockedModelId = dynamicModelRouter.getLockedModelId();
  const errorSimState = dynamicModelRouter.getSimulatedErrorState();

  res.json({
    activeModel,
    lockedModelId,
    isLocked: Boolean(lockedModelId),
    modelChain: MODEL_CHAIN,
    errorSimState,
  });
});

apiApp.post("/api/system/model-lock", requireAdmin, (req: Request, res: Response) => {
  const { modelId } = req.body;
  // modelId can be "gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.5-flash-8b", or null (for auto)
  dynamicModelRouter.setManualLock(modelId as ModelPriorityId | null);

  res.json({
    success: true,
    activeModel: dynamicModelRouter.getActiveModel(),
    lockedModelId: dynamicModelRouter.getLockedModelId(),
  });
});

apiApp.post("/api/system/simulate-routing-error", requireAdmin, (req: Request, res: Response) => {
  const { errorType, count = 3 } = req.body;
  // errorType can be "429", "503", or null
  dynamicModelRouter.setSimulatedError(errorType, count);

  res.json({
    success: true,
    message: errorType
      ? `Primed next ${count} requests with simulated HTTP ${errorType} to verify exponential backoff & failover.`
      : "Cleared simulated routing error.",
    simulatedErrorState: dynamicModelRouter.getSimulatedErrorState(),
  });
});

apiApp.post("/api/system/trigger-regression", requireAdmin, (_req: Request, res: Response) => {
  vanguardContinuousLoop.injectSimulatedRegression();
  res.json({
    success: true,
    message: "Synthetic regression injected. Watch the Live Terminal for instant autonomous remediation.",
  });
});

// --------------------------------------------------------------------------
// 4. System State & Kill Switch APIs
// --------------------------------------------------------------------------
apiApp.get("/api/system/state", (_req: Request, res: Response) => {
  const activeModel = dynamicModelRouter.getActiveModel();
  res.json({
    state: systemState.getState(),
    activeModel,
    pendingCount: systemState.getPendingUpdates().filter((u) => u.status === "PENDING").length,
    approvedCount: systemState.getPendingUpdates().filter((u) => u.status === "APPROVED").length,
  });
});

apiApp.post("/api/system/kill-switch", requireAdmin, (req: Request, res: Response) => {
  const { killSwitch, userEmail } = req.body;
  if (typeof killSwitch !== "boolean") {
    return res.status(400).json({ error: "Field 'killSwitch' must be a boolean." });
  }

  const newState = systemState.setKillSwitch(killSwitch, userEmail);
  vanguardWebSocket.broadcast({
    type: "kill_switch_toggled",
    killSwitch: newState,
    userEmail,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    killSwitch: newState,
    systemState: systemState.getState(),
  });
});

// --------------------------------------------------------------------------
// 5. Pending Updates Queue APIs (Admin PR Queue)
// --------------------------------------------------------------------------
apiApp.get("/api/system/updates", (_req: Request, res: Response) => {
  res.json({
    updates: systemState.getPendingUpdates(),
  });
});

apiApp.post("/api/system/updates/:id/action", requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { action, reviewedBy = "Vanguard Executive" } = req.body;

  if (action !== "APPROVE" && action !== "REJECT") {
    return res.status(400).json({ error: "Action must be 'APPROVE' or 'REJECT'." });
  }

  const updated = systemState.updatePrStatus(id, action, reviewedBy);
  if (!updated) {
    return res.status(404).json({ error: `Update with id '${id}' not found.` });
  }

  vanguardWebSocket.broadcastLog({
    level: "INFO",
    source: "admin-audit",
    message: `PR [${id}] ${action}D by ${reviewedBy}. Target: ${updated.targetFile}`,
  });

  res.json({
    success: true,
    update: updated,
  });
});

// --------------------------------------------------------------------------
// 6. Telemetry & Terminal Logs
// --------------------------------------------------------------------------
apiApp.get("/api/system/telemetry", (req: Request, res: Response) => {
  const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 40));
  res.json({
    logs: systemState.getTelemetryLogs(limit),
    tokensUsage: systemState.getState().tokensUsage,
    killSwitch: systemState.getKillSwitch(),
    activeModel: dynamicModelRouter.getActiveModel(),
  });
});

apiApp.get("/api/system/terminal-events", (_req: Request, res: Response) => {
  res.json({
    logs: vanguardWebSocket.getRecentLogs(),
    activeModel: dynamicModelRouter.getActiveModel(),
    killSwitch: systemState.getKillSwitch(),
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling middleware to prevent API crashes
apiApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Vanguard API Error Handler]:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "An internal server error occurred.",
      message: err?.message || String(err),
    });
  }
});

