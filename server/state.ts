import { AutomatedTestResult } from "./sandbox.js";

export type AutoDeployPolicy = "FULL_AUTONOMY" | "STRICT_MODE";

export interface ImpactRiskAssessment {
  severity: "ROUTINE" | "CRITICAL";
  riskLevel: "LOW" | "HIGH";
  riskScore: number;
  category: "BUG_FIX" | "PERFORMANCE" | "SECURITY" | "DATABASE_SCHEMA" | "API_BREAKING" | "DEPENDENCIES" | "REFACTOR";
  reasons: string[];
  requiresApproval: boolean;
  autoDeployEligible: boolean;
}

export interface PendingUpdateRecord {
  id: string;
  title: string;
  branch: string;
  targetFile: string;
  summary: string;
  diff: string;
  additions: number;
  deletions: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_MERGED";
  testResults: AutomatedTestResult;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  impactRisk?: ImpactRiskAssessment;
  isFastTrack?: boolean;
  isSandboxVerified?: boolean;
}

export interface TelemetryLogRecord {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR";
  source: string;
  message: string;
  tokensUsed?: number;
}

export interface SystemStateData {
  killSwitch: boolean;
  autonomousLoopActive: boolean;
  autoDeployPolicy: AutoDeployPolicy;
  lastHourlyTriggerAt: string | null;
  totalTriggersRun: number;
  tokensUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCalls: number;
  };
}

// In-memory runtime state that syncs and backs up the autonomous loop
class SystemStateManager {
  private killSwitch: boolean = false;
  private autonomousLoopActive: boolean = true;
  private autoDeployPolicy: AutoDeployPolicy = "FULL_AUTONOMY";
  private lastHourlyTriggerAt: string | null = new Date(Date.now() - 32 * 60 * 1000).toISOString();
  private totalTriggersRun: number = 8;
  private tokensUsage = {
    promptTokens: 14250,
    completionTokens: 28410,
    totalTokens: 42660,
    totalCalls: 34,
  };

  private pendingUpdates: PendingUpdateRecord[] = [];
  private telemetryLogs: TelemetryLogRecord[] = [];

  constructor() {
    this.seedInitialState();
  }

  private seedInitialState() {
    // Seed initial pending updates
    this.pendingUpdates = [
      {
        id: "pr-1042",
        title: "fix(rate-limit): introduce sliding-window token bucket on /api/chat",
        branch: "patch/sliding-window-limiter",
        targetFile: "src/middleware/rateLimiter.ts",
        summary:
          "Analysis of high burst telemetry revealed that clients were encountering unhandled 502 gateway timeouts rather than orderly 429 backpressure. Implemented a sliding window token-bucket limiter with response headers indicating retry-after.",
        diff: `--- a/src/middleware/rateLimiter.ts
+++ b/src/middleware/rateLimiter.ts
@@ -10,6 +10,18 @@ export function createRateLimiter(options: RateLimiterOptions) {
   const memoryStore = new Map<string, number[]>();

   return (req: Request, res: Response, next: NextFunction) => {
-    next();
+    const now = Date.now();
+    const clientIp = req.ip || '0.0.0.0';
+    const timestamps = memoryStore.get(clientIp) || [];
+    const windowStart = now - options.windowMs;
+    const recent = timestamps.filter(t => t > windowStart);
+    
+    if (recent.length >= options.maxRequests) {
+      res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
+      return res.status(429).json({ error: 'Rate limit exceeded. Please back off.' });
+    }
+    recent.push(now);
+    memoryStore.set(clientIp, recent);
+    next();
   };
 }`,
        additions: 15,
        deletions: 1,
        status: "PENDING",
        testResults: {
          passed: true,
          passRate: 1.0,
          totalTests: 28,
          passedTests: 28,
          failedTests: 0,
          executionTimeMs: 412,
          sandboxId: "sbx-docker-98a41f",
          runtimeVersion: "Node.js v22.14-alpine-sandboxed",
          suites: [
            {
              suite: "AST & Syntax Validator",
              name: "Clean TypeScript parse without diagnostics",
              durationMs: 44,
              status: "PASSED",
              assertions: 8,
            },
            {
              suite: "Security Sandbox Check",
              name: "Zero filesystem writes outside sandbox perimeter",
              durationMs: 72,
              status: "PASSED",
              assertions: 6,
            },
            {
              suite: "Rate Limiter Stress Harness",
              name: "Sustain 10,000 req/sec sliding window verification",
              durationMs: 180,
              status: "PASSED",
              assertions: 14,
            },
          ],
          summary: "All 28 automated test cases in sandbox passed with 100% coverage.",
        },
        createdAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      },
      {
        id: "pr-1041",
        title: "perf(cache): serialize telemetry payloads to compact BinaryBuffer",
        branch: "perf/compact-binary-telemetry",
        targetFile: "src/telemetry/serializer.ts",
        summary:
          "Reduced network payload overhead by 46% across internal worker nodes by adopting MessagePack encoding for telemetry packet bursts exceeding 16KB.",
        diff: `--- a/src/telemetry/serializer.ts
+++ b/src/telemetry/serializer.ts
@@ -5,4 +5,8 @@ export function encodeTelemetry(data: object): Uint8Array {
-  return new TextEncoder().encode(JSON.stringify(data));
+  if (Object.keys(data).length > 20) {
+    return compressPayload(data);
+  }
+  return new TextEncoder().encode(JSON.stringify(data));
 }`,
        additions: 5,
        deletions: 1,
        status: "APPROVED",
        testResults: {
          passed: true,
          passRate: 1.0,
          totalTests: 18,
          passedTests: 18,
          failedTests: 0,
          executionTimeMs: 380,
          sandboxId: "sbx-docker-77c82e",
          runtimeVersion: "Node.js v22.14-alpine-sandboxed",
          suites: [
            {
              suite: "Compression Fidelity",
              name: "Exact round-trip verification across schema edge cases",
              durationMs: 120,
              status: "PASSED",
              assertions: 18,
            },
          ],
          summary: "All 18 automated test cases in sandbox passed with 100% coverage.",
        },
        createdAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
        reviewedBy: "nikhilprajapathi1@gmail.com",
        reviewedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      },
    ];

    // Seed telemetry logs
    this.telemetryLogs = [
      {
        id: "log-1",
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        level: "INFO",
        source: "cron-scheduler",
        message: "Scheduled trigger check: system operational, 0 critical alerts active.",
      },
      {
        id: "log-2",
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        level: "WARN",
        source: "worker-node-2",
        message: "Spike in client connection concurrency: pool capacity reached 82%.",
      },
      {
        id: "log-3",
        timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
        level: "INFO",
        source: "ci-cd-webhook",
        message: "Hourly trigger executed successfully. Generated PR-1042 after sandbox pass.",
        tokensUsed: 470,
      },
      {
        id: "log-4",
        timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        level: "ERROR",
        source: "rate-limiter-gateway",
        message: "Burst traffic detected: 429 Too Many Requests count exceeded baseline by 180%.",
      },
      {
        id: "log-5",
        timestamp: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
        level: "INFO",
        source: "sandbox-runner",
        message: "Docker sandbox runtime healthy. Image hash: sha256:d84f182c cached.",
      },
      {
        id: "log-6",
        timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        level: "INFO",
        source: "admin-audit",
        message: "Executive approval granted for PR-1041 by admin nikhilprajapathi1@gmail.com.",
      },
    ];
  }

  public getKillSwitch(): boolean {
    return this.killSwitch;
  }

  public getAutoDeployPolicy(): AutoDeployPolicy {
    return this.autoDeployPolicy;
  }

  public setAutoDeployPolicy(policy: AutoDeployPolicy, userEmail?: string): AutoDeployPolicy {
    this.autoDeployPolicy = policy;
    this.addLog({
      level: "INFO",
      source: "policy-control",
      message: `Auto-Deploy Policy changed to [${policy}] by ${userEmail || "Executive Admin"}. ${
        policy === "FULL_AUTONOMY"
          ? "Routine changes will auto-deploy immediately upon 100% test pass; critical changes require approval."
          : "Strict Mode enabled: ALL changes require manual Executive Admin approval."
      }`,
    });
    return this.autoDeployPolicy;
  }

  public setKillSwitch(value: boolean, userEmail?: string): boolean {
    this.killSwitch = value;
    this.addLog({
      level: value ? "ERROR" : "INFO",
      source: "kill-switch-control",
      message: value
        ? `GLOBAL KILL SWITCH ENGAGED by ${userEmail || "Executive Admin"}. All autonomous AI routines, background scripts, and CI/CD triggers are strictly HALTED.`
        : `GLOBAL KILL SWITCH DISENGAGED by ${userEmail || "Executive Admin"}. Normal autonomous operations resumed.`,
    });
    return this.killSwitch;
  }

  public getState(): SystemStateData {
    return {
      killSwitch: this.killSwitch,
      autonomousLoopActive: !this.killSwitch && this.autonomousLoopActive,
      autoDeployPolicy: this.autoDeployPolicy,
      lastHourlyTriggerAt: this.lastHourlyTriggerAt,
      totalTriggersRun: this.totalTriggersRun,
      tokensUsage: { ...this.tokensUsage },
    };
  }

  public recordTokenUsage(promptTokens: number, completionTokens: number) {
    this.tokensUsage.promptTokens += promptTokens;
    this.tokensUsage.completionTokens += completionTokens;
    this.tokensUsage.totalTokens += promptTokens + completionTokens;
    this.tokensUsage.totalCalls += 1;
  }

  public getPendingUpdates(): PendingUpdateRecord[] {
    return [...this.pendingUpdates];
  }

  public addPendingUpdate(
    update: Omit<PendingUpdateRecord, "id" | "createdAt" | "status"> & {
      status?: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_MERGED";
    }
  ): PendingUpdateRecord {
    const record: PendingUpdateRecord = {
      ...update,
      id: `pr-${Math.floor(1000 + Math.random() * 9000)}`,
      status: update.status || "PENDING",
      createdAt: new Date().toISOString(),
    };
    this.pendingUpdates.unshift(record);
    this.lastHourlyTriggerAt = record.createdAt;
    this.totalTriggersRun += 1;

    const fastTrackPrefix = record.isFastTrack ? "[Fast-Track (Sandbox Verified)] " : "";
    const logMessage =
      record.status === "AUTO_MERGED"
        ? `${fastTrackPrefix}[Auto-Deployed]: Routine fix [${record.id}] "${record.title}" auto-merged to production (Severity: ${
            record.impactRisk?.severity || "ROUTINE"
          }). Phase 3 Sandbox: 100% Passed (0 Errors). Zero Admin permission required.`
        : `${fastTrackPrefix}SystemDevService synthesized update [${record.id}]: "${record.title}". Severity: ${
            record.impactRisk?.severity || "ROUTINE"
          }. ${
            record.impactRisk?.requiresApproval ? "Approval required: high-impact change detected." : "Queued for review."
          }`;

    this.addLog({
      level: record.status === "AUTO_MERGED" ? "INFO" : "WARN",
      source: record.status === "AUTO_MERGED" ? "auto-deploy-engine" : "ci-cd-webhook",
      message: logMessage,
    });

    return record;
  }

  public updatePrStatus(id: string, action: "APPROVE" | "REJECT", reviewedBy: string): PendingUpdateRecord | null {
    const pr = this.pendingUpdates.find((p) => p.id === id);
    if (!pr) return null;

    pr.status = action === "APPROVE" ? "APPROVED" : "REJECTED";
    pr.reviewedBy = reviewedBy;
    pr.reviewedAt = new Date().toISOString();

    this.addLog({
      level: action === "APPROVE" ? "INFO" : "WARN",
      source: "admin-audit",
      message: `Update [${pr.id}] was ${pr.status} by ${reviewedBy}. Target: ${pr.targetFile} on branch ${pr.branch}.`,
    });

    return pr;
  }

  public getTelemetryLogs(limitCount: number = 50): TelemetryLogRecord[] {
    return [...this.telemetryLogs].slice(0, limitCount);
  }

  public addLog(log: Omit<TelemetryLogRecord, "id" | "timestamp">): TelemetryLogRecord {
    const entry: TelemetryLogRecord = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.telemetryLogs.unshift(entry);
    if (this.telemetryLogs.length > 200) {
      this.telemetryLogs.pop();
    }
    return entry;
  }
}

export const systemState = new SystemStateManager();
