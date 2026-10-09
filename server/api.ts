import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { systemState } from "./state.js";
import { handleUserChat, streamUserChat } from "./userService.js";
import { analyzeLogsAndGenerateUpdate } from "./systemDevService.js";
import { runAutomatedTests } from "./sandbox.js";
import { dynamicModelRouter, MODEL_CHAIN, ModelPriorityId } from "./modelRouter.js";
import { vanguardContinuousLoop } from "./continuousLoop.js";
import { vanguardWebSocket } from "./websocketService.js";
import { vanguardUpgradeService } from "./upgradeService.js";
import { autonomousLearningEngine, LearningSourceId } from "./learningEngine.js";
import { selfDiagnosticService } from "./diagnosticService.js";
import { fastCodeAuditService } from "./fastCodeAuditService.js";
import { fileSystemService } from "./fileSystemService.js";
import {
  ADMIN_SECRET_KEY,
  timingSafeCompare,
  hashPassword,
  verifyPassword,
  sanitizeInputsMiddleware,
  securityHeadersMiddleware,
  authRateLimiter,
  chatRateLimiter,
  generalApiRateLimiter,
  getCorsOptions,
} from "./securityService.js";

export { ADMIN_SECRET_KEY };
export const apiApp = express();

// Turn off debug headers and enforce security perimeter
apiApp.disable("x-powered-by");
apiApp.use(cors(getCorsOptions()));
apiApp.use(securityHeadersMiddleware);
apiApp.use(express.json({ limit: "1mb" }));
apiApp.use(sanitizeInputsMiddleware);
apiApp.use("/api", generalApiRateLimiter.createMiddleware());

// Strict Admin Authentication Guard: Verifying Authorization: Bearer 456123 via constant-time comparison
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"] || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerKey = ((req.headers["x-admin-key"] as string) || "").trim();

  // Strictly validate against the hardcoded secret key '456123' using constant-time check
  const isAuthorizedBearer = Boolean(bearerToken && timingSafeCompare(bearerToken, ADMIN_SECRET_KEY));
  const isAuthorizedHeader = Boolean(headerKey && timingSafeCompare(headerKey, ADMIN_SECRET_KEY));

  if (isAuthorizedBearer || isAuthorizedHeader) {
    return next();
  }

  // Audit log failed admin access attempt for telemetry
  vanguardWebSocket.broadcastLog({
    level: "WARN",
    source: "security-guard",
    message: `[SECURITY AUDIT]: Blocked unauthorized admin access attempt on ${req.method} ${req.path}.`,
  });

  return res.status(401).json({
    error: "Unauthorized: Invalid or missing Admin Security Key.",
    message: "Authorization: Bearer 456123 is required to access Vanguard AI Admin systems.",
    requiredHeader: "Authorization: Bearer 456123",
  });
}

// --------------------------------------------------------------------------
// 1. User Mode Chat API (UserService with Dynamic Model Router & SSE Streaming)
// --------------------------------------------------------------------------
apiApp.post("/api/chat/stream", chatRateLimiter.createMiddleware("Chat request threshold exceeded. Please wait a moment."), async (req: Request, res: Response) => {
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

apiApp.post("/api/chat", chatRateLimiter.createMiddleware("Chat request threshold exceeded. Please wait a moment."), async (req: Request, res: Response) => {
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
apiApp.post("/api/internal/hourly-trigger", requireAdmin, async (req: Request, res: Response) => {
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
apiApp.get("/api/system/updates", requireAdmin, (_req: Request, res: Response) => {
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

  // Wake up held upgrade pipeline if it was holding for this PR approval
  vanguardUpgradeService.resolveAdminApproval(id, action);

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
// 5b. Auto-Deploy Policy Control APIs (Admin Only)
// --------------------------------------------------------------------------
apiApp.get("/api/system/policy", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    autoDeployPolicy: systemState.getAutoDeployPolicy(),
  });
});

apiApp.post("/api/system/policy", requireAdmin, (req: Request, res: Response) => {
  const { policy, userEmail } = req.body;
  if (policy !== "FULL_AUTONOMY" && policy !== "STRICT_MODE") {
    return res.status(400).json({ error: "Policy must be 'FULL_AUTONOMY' or 'STRICT_MODE'." });
  }

  const updated = systemState.setAutoDeployPolicy(policy, userEmail);
  vanguardWebSocket.broadcast({
    type: "policy_updated",
    policy: updated,
    userEmail,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    policy: updated,
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

// --------------------------------------------------------------------------
// 7. Continuous Upgrade Pipeline Controls (Admin Only)
// --------------------------------------------------------------------------
apiApp.get("/api/system/upgrade/status", requireAdmin, (_req: Request, res: Response) => {
  res.json(vanguardUpgradeService.getStatus());
});

apiApp.post("/api/system/upgrade/start", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { focusTopic } = req.body || {};
    const state = await vanguardUpgradeService.startUpgrade(focusTopic);
    res.json({
      success: true,
      message: "Autonomous upgrade pipeline initiated. Background refactoring engine set to ACTIVE.",
      state,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to start upgrade" });
  }
});

apiApp.post("/api/system/upgrade/stop", requireAdmin, (_req: Request, res: Response) => {
  try {
    const state = vanguardUpgradeService.stopUpgrade();
    res.json({
      success: true,
      message: "Autonomous upgrade process paused safely without tripping the emergency Kill Switch.",
      state,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to stop upgrade" });
  }
});

// --------------------------------------------------------------------------
// 8. Autonomous Learning Engine APIs (Admin Only - YouTube, GitHub, Google, Wikipedia)
// --------------------------------------------------------------------------
apiApp.get("/api/system/learning/sources", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    sources: autonomousLearningEngine.getSources(),
  });
});

apiApp.post("/api/system/learning/sources/:sourceId/toggle", requireAdmin, (req: Request, res: Response) => {
  const { sourceId } = req.params;
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "Field 'enabled' must be a boolean." });
  }

  try {
    const updated = autonomousLearningEngine.toggleSource(sourceId as LearningSourceId, enabled);
    res.json({ success: true, source: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiApp.get("/api/system/learning/artifacts", requireAdmin, (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  res.json({
    artifacts: autonomousLearningEngine.getArtifacts(limit),
  });
});

apiApp.post("/api/system/learning/research", requireAdmin, async (req: Request, res: Response) => {
  const { topic } = req.body;
  if (!topic || typeof topic !== "string") {
    return res.status(400).json({ error: "Query topic must be a non-empty string." });
  }

  try {
    const newlyAcquired = await autonomousLearningEngine.researchTopic(topic);
    res.json({
      success: true,
      topic,
      acquiredCount: newlyAcquired.length,
      artifacts: newlyAcquired,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to research topic" });
  }
});

apiApp.get("/api/system/learning/metrics", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    metrics: autonomousLearningEngine.getMetrics(),
  });
});

apiApp.get("/api/system/learning/ticker", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    ticker: autonomousLearningEngine.getTickerStream(20),
  });
});

apiApp.get("/api/system/learning/active-item", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    activeLearningItem: autonomousLearningEngine.getActiveLearningItem(),
  });
});

// --------------------------------------------------------------------------
// 9. Autonomous Self-Diagnostic & Auto-Triggered Self-Healing APIs
// --------------------------------------------------------------------------
apiApp.get("/api/system/diagnostic/status", requireAdmin, (_req: Request, res: Response) => {
  res.json(selfDiagnosticService.getStatus());
});

apiApp.post("/api/system/diagnostic/scan", requireAdmin, (_req: Request, res: Response) => {
  const status = selfDiagnosticService.runDiagnosticScan();
  res.json({
    success: true,
    message: "Self-diagnostic scan completed across all AST nodes.",
    status,
  });
});

apiApp.post("/api/system/diagnostic/simulate-pattern", requireAdmin, (req: Request, res: Response) => {
  try {
    const { component, patternName, detectedReason, modernAlternative } = req.body || {};
    const status = selfDiagnosticService.triggerSubOptimalPattern({
      component,
      patternName,
      detectedReason,
      modernAlternative,
    });
    res.json({
      success: true,
      message: "Sub-optimal code pattern detected. Auto-triggered 4-phase upgrade pipeline.",
      status,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to simulate pattern." });
  }
});

// --------------------------------------------------------------------------
// 10. Accelerated Self-Code Audit Engine APIs (FastCodeAuditService)
// --------------------------------------------------------------------------
apiApp.get("/api/system/fast-audit/status", requireAdmin, (_req: Request, res: Response) => {
  res.json(fastCodeAuditService.getStatus());
});

apiApp.post("/api/system/fast-audit/run", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { component, flawType } = req.body || {};
    const result = await fastCodeAuditService.triggerFastTrackUpgrade({
      component,
      flawType,
      simulateFlaw: false,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to trigger fast-track audit." });
  }
});

apiApp.post("/api/system/fast-audit/simulate-flaw", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { component, flawType } = req.body || {};
    const result = await fastCodeAuditService.triggerFastTrackUpgrade({
      component,
      flawType,
      simulateFlaw: true,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to simulate flaw." });
  }
});

// --------------------------------------------------------------------------
// 11. Admin Security Key Verification Endpoint (Hardcoded Secret: 456123)
// Protected with strict rate limiting and constant-time equality check
// --------------------------------------------------------------------------
apiApp.post(
  "/api/system/auth/verify-key",
  authRateLimiter.createMiddleware("Authentication throttle triggered. Maximum 5 attempts per minute permitted."),
  (req: Request, res: Response) => {
    const { key } = req.body || {};
    const keyStr = typeof key === "string" ? key.trim() : "";

    if (timingSafeCompare(keyStr, ADMIN_SECRET_KEY)) {
      vanguardWebSocket.broadcastLog({
        level: "INFO",
        source: "security-guard",
        message: "[SECURITY AUDIT]: Admin authenticated with verified Security Key.",
      });

      return res.json({
        success: true,
        token: ADMIN_SECRET_KEY,
        message: "Admin security key authenticated successfully. Session unlocked.",
      });
    }

    vanguardWebSocket.broadcastLog({
      level: "WARN",
      source: "security-guard",
      message: "[SECURITY AUDIT]: Failed Admin Security Key verification attempt.",
    });

    return res.status(401).json({
      success: false,
      error: "Invalid Admin Security Key. Access strictly denied.",
    });
  }
);

// --------------------------------------------------------------------------
// 11b. Cryptographic Credential Hashing & Security Verification (Scrypt + Salt)
// --------------------------------------------------------------------------
apiApp.post("/api/system/auth/hash-credential", requireAdmin, (req: Request, res: Response) => {
  const { credential } = req.body || {};
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ error: "Field 'credential' must be a non-empty string." });
  }

  const { hash, salt } = hashPassword(credential);
  res.json({
    success: true,
    algorithm: "scrypt",
    keyLength: 64,
    salt,
    hash,
    message: "Credential securely hashed using Scrypt with 16-byte cryptographic salt.",
  });
});

apiApp.post("/api/system/auth/verify-credential", (req: Request, res: Response) => {
  const { credential, hash, salt } = req.body || {};
  if (!credential || !hash || !salt) {
    return res.status(400).json({ error: "Fields 'credential', 'hash', and 'salt' are required." });
  }

  const isValid = verifyPassword(credential, hash, salt);
  res.json({
    success: isValid,
    verified: isValid,
  });
});

// --------------------------------------------------------------------------
// 12. Omniscient File System Access APIs (Protected by requireAdmin)
// --------------------------------------------------------------------------
apiApp.get("/api/system/fs/tree", requireAdmin, (req: Request, res: Response) => {
  try {
    const rootPath = (req.query.root as string) || "src";
    const tree = fileSystemService.getDirectoryTree(rootPath);
    res.json({ success: true, tree });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiApp.get("/api/system/fs/file", requireAdmin, (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Query parameter 'path' is required." });
    }
    const fileData = fileSystemService.readFile(filePath);
    res.json({ success: true, file: fileData });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiApp.post("/api/system/fs/file", requireAdmin, (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body || {};
    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "Fields 'path' and 'content' are required." });
    }
    const result = fileSystemService.writeFile(filePath, content);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.get("/api/system/fs/stats", requireAdmin, (_req: Request, res: Response) => {
  try {
    const stats = fileSystemService.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiApp.get("/api/system/fs/search", requireAdmin, (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const matches = fileSystemService.searchCode(q);
    res.json({ success: true, matches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Centralized error handling middleware with sanitized responses (No debug stack leaks)
apiApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Vanguard API Error Handler]:", err);
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal server error",
      message: "An unexpected error occurred. Request logged for security review.",
    });
  }
});

