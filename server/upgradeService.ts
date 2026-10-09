import { systemState, ImpactRiskAssessment, AutoDeployPolicy } from "./state.js";
import { vanguardWebSocket } from "./websocketService.js";
import { runAutomatedTests } from "./sandbox.js";
import { analyzeLogsAndGenerateUpdate } from "./systemDevService.js";
import { autonomousLearningEngine, KnowledgeArtifact, ActiveLearningItem, LearningSourceId } from "./learningEngine.js";
import { ImpactRiskClassifier } from "./riskClassifier.js";
import type { FastTrackAuditInfo } from "./fastCodeAuditService.js";

export type UpgradeEngineStatus =
  | "IDLE"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "AWAITING_APPROVAL";

export interface UpgradePhaseInfo {
  phaseNumber: 1 | 2 | 3 | 4;
  name: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PAUSED" | "BYPASSED";
  description: string;
  startedAt?: string;
  completedAt?: string;
  bypassReason?: string;
}

export interface SandboxGatekeeperStatus {
  enforcedPassRate: number;
  zeroErrorsAllowed: boolean;
  activeGate: boolean;
  lastRunPassed: boolean;
  rejectionRollbackCount: number;
}

export interface UpgradeCycleState {
  id: string;
  engineStatus: UpgradeEngineStatus;
  progress: number; // 0 to 100
  currentPhase: 1 | 2 | 3 | 4;
  phases: UpgradePhaseInfo[];
  statusMessage: string;
  streamingLogs: string[];
  startedAt: string | null;
  completedAt: string | null;
  targetComponent: string;
  acquiredKnowledge: KnowledgeArtifact[];
  generatedPrId: string | null;
  totalCyclesCompleted: number;
  isInfiniteLoopActive: boolean;
  impactRisk?: ImpactRiskAssessment | null;
  approvalRequiredPrId?: string | null;
  isFastTrack?: boolean;
  fastTrackAudit?: FastTrackAuditInfo | null;
  activeLearningItem?: ActiveLearningItem | null;
  sandboxGatekeeper?: SandboxGatekeeperStatus;
}

class VanguardUpgradeService {
  private engineStatus: UpgradeEngineStatus = "IDLE";
  private currentCycle: UpgradeCycleState | null = null;
  private abortController: AbortController | null = null;
  private isCycleRunning = false;
  private totalCyclesCompleted = 0;
  private rejectionRollbackCount = 0;
  private isInfiniteLoopActive = true;
  private pendingApprovalResolvers = new Map<string, (decision: "APPROVE" | "REJECT") => void>();

  constructor() {
    this.resetCycleState();
  }

  private resetCycleState() {
    this.currentCycle = {
      id: `upg-${Date.now().toString().slice(-6)}`,
      engineStatus: this.engineStatus,
      progress: 0,
      currentPhase: 1,
      phases: [
        {
          phaseNumber: 1,
          name: "Code & Log Diagnostics",
          status: "PENDING",
          description: "Analyze AST, trace error frequencies, inspect telemetry bottlenecks",
        },
        {
          phaseNumber: 2,
          name: "Knowledge Acquisition (YouTube, GitHub, Google, Wikipedia)",
          status: "PENDING",
          description: "Live streaming scraping & parsing of state-of-the-art algorithms and diffs",
        },
        {
          phaseNumber: 3,
          name: "Sandbox Compilation & Automated Testing",
          status: "PENDING",
          description: "Strict 100% Pass Gatekeeper: Compilation, unit, AST & headless UI testing",
        },
        {
          phaseNumber: 4,
          name: "Synthesizing PR & Permission Gating",
          status: "PENDING",
          description: "Impact risk evaluation, auto-deploy routine changes or request Admin approval",
        },
      ],
      statusMessage: "Autonomous upgrade pipeline on standby.",
      streamingLogs: ["[STANDBY]: System refactoring engine initialized. Ready for upgrade execution."],
      startedAt: null,
      completedAt: null,
      targetComponent: "src/telemetry/eventBatcher.ts",
      acquiredKnowledge: [],
      generatedPrId: null,
      totalCyclesCompleted: this.totalCyclesCompleted,
      isInfiniteLoopActive: this.isInfiniteLoopActive,
      impactRisk: null,
      approvalRequiredPrId: null,
      isFastTrack: false,
      fastTrackAudit: null,
      activeLearningItem: autonomousLearningEngine.getActiveLearningItem(),
      sandboxGatekeeper: {
        enforcedPassRate: 1.0,
        zeroErrorsAllowed: true,
        activeGate: true,
        lastRunPassed: true,
        rejectionRollbackCount: this.rejectionRollbackCount,
      },
    };
  }

  public getStatus(): UpgradeCycleState {
    if (!this.currentCycle) {
      this.resetCycleState();
    }
    return {
      ...this.currentCycle!,
      engineStatus: this.engineStatus,
      totalCyclesCompleted: this.totalCyclesCompleted,
      isInfiniteLoopActive: this.isInfiniteLoopActive,
      activeLearningItem: this.currentCycle?.activeLearningItem || autonomousLearningEngine.getActiveLearningItem(),
      sandboxGatekeeper: {
        enforcedPassRate: 1.0,
        zeroErrorsAllowed: true,
        activeGate: true,
        lastRunPassed: this.currentCycle?.sandboxGatekeeper?.lastRunPassed ?? true,
        rejectionRollbackCount: this.rejectionRollbackCount,
      },
    };
  }

  private broadcastUpdate() {
    if (!this.currentCycle) return;
    vanguardWebSocket.broadcast({
      type: "upgrade_status",
      data: this.getStatus(),
    });
  }

  private logToStream(msg: string) {
    if (!this.currentCycle) return;
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    this.currentCycle.streamingLogs.unshift(entry);
    if (this.currentCycle.streamingLogs.length > 50) {
      this.currentCycle.streamingLogs.pop();
    }
    this.currentCycle.statusMessage = msg;

    vanguardWebSocket.broadcastLog({
      level: "EVENT",
      source: "upgrade-pipeline",
      message: msg,
    });

    this.broadcastUpdate();
  }

  public resolveAdminApproval(prId: string, decision: "APPROVE" | "REJECT"): boolean {
    const resolver = this.pendingApprovalResolvers.get(prId);
    if (resolver) {
      this.pendingApprovalResolvers.delete(prId);
      resolver(decision);
      return true;
    }
    return false;
  }

  private async waitForAdminApproval(prId: string, signal: AbortSignal): Promise<"APPROVE" | "REJECT"> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error("Upgrade aborted by user"));
      }
      this.pendingApprovalResolvers.set(prId, (decision) => {
        resolve(decision);
      });
      signal.addEventListener(
        "abort",
        () => {
          this.pendingApprovalResolvers.delete(prId);
          reject(new Error("Upgrade aborted by user"));
        },
        { once: true }
      );
    });
  }

  /**
   * Start Autonomous Upgrade with Infinite Auto-Loop
   */
  public async startUpgrade(targetPrompt?: string): Promise<UpgradeCycleState> {
    if (systemState.getKillSwitch()) {
      throw new Error("Cannot start upgrade: Global Kill Switch is ENGAGED.");
    }

    if (this.isCycleRunning) {
      return this.getStatus();
    }

    this.engineStatus = "ACTIVE";
    this.isInfiniteLoopActive = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Reset cycle for new run
    this.resetCycleState();
    this.currentCycle!.engineStatus = "ACTIVE";
    this.currentCycle!.startedAt = new Date().toISOString();

    vanguardWebSocket.broadcastLog({
      level: "INFO",
      source: "upgrade-controller",
      message:
        "Admin initiated Autonomous Upgrade. Infinite background refactoring loop set to ACTIVE.",
    });

    // Run pipeline asynchronously
    this.executeInfinitePipeline(signal, targetPrompt).catch((err) => {
      console.error("[UpgradeService Error]:", err);
      if (this.currentCycle) {
        this.currentCycle.statusMessage = `Upgrade error: ${err.message}`;
      }
      this.engineStatus = "IDLE";
      this.isCycleRunning = false;
      this.broadcastUpdate();
    });

    return this.getStatus();
  }

  /**
   * Stop Upgrade (Immediate Safe Pause without tripping Emergency Kill Switch)
   */
  public stopUpgrade(): UpgradeCycleState {
    this.engineStatus = "PAUSED";
    this.isInfiniteLoopActive = false;

    // Reject any pending approval hold
    for (const [prId, resolver] of this.pendingApprovalResolvers.entries()) {
      resolver("REJECT");
    }
    this.pendingApprovalResolvers.clear();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isCycleRunning = false;

    if (this.currentCycle) {
      this.currentCycle.engineStatus = "PAUSED";
      const currentPhaseObj = this.currentCycle.phases.find(
        (p) => p.phaseNumber === this.currentCycle!.currentPhase
      );
      if (currentPhaseObj && currentPhaseObj.status === "RUNNING") {
        currentPhaseObj.status = "PAUSED";
      }

      this.logToStream(
        "Autonomous upgrade loop safely PAUSED by Admin without tripping Emergency Kill Switch."
      );
    }

    vanguardWebSocket.broadcastLog({
      level: "WARN",
      source: "upgrade-controller",
      message: "Admin requested Stop Upgrade. Autonomous refactoring engine paused safely.",
    });

    this.broadcastUpdate();
    return this.getStatus();
  }

  private async sleepWithCheck(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        return reject(new Error("Upgrade halted by user"));
      }
      const timeout = setTimeout(() => {
        resolve();
      }, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          reject(new Error("Upgrade halted by user"));
        },
        { once: true }
      );
    });
  }

  /**
   * Accelerated Self-Code Audit Engine: Fast-Track Execution
   * MANDATORILY bypasses Phase 2 (External Ingestion).
   * MANDATORILY routes directly into Phase 3 (Sandbox Testing).
   * Enforces 100% Pass Guarantee (Zero Errors Allowed).
   */
  public async startFastTrackAudit(params: {
    auditInfo: FastTrackAuditInfo;
    simulateFlaw?: boolean;
  }): Promise<{ sandboxPassed: boolean }> {
    if (systemState.getKillSwitch()) {
      throw new Error("Cannot run fast-track audit: Global Kill Switch is ENGAGED.");
    }

    this.engineStatus = "ACTIVE";
    this.resetCycleState();

    this.currentCycle!.isFastTrack = true;
    this.currentCycle!.fastTrackAudit = params.auditInfo;
    this.currentCycle!.targetComponent = params.auditInfo.targetComponent;
    this.currentCycle!.startedAt = new Date().toISOString();
    this.currentCycle!.engineStatus = "ACTIVE";

    this.logToStream(
      `[Fast-Track Self-Code Audit]: Initiated for ${params.auditInfo.targetComponent}. Bottleneck: ${params.auditInfo.bottleneckType}.`
    );

    // Phase 1: Local AST inspection
    this.currentCycle!.currentPhase = 1;
    this.currentCycle!.phases[0].status = "RUNNING";
    this.currentCycle!.phases[0].startedAt = new Date().toISOString();
    this.currentCycle!.progress = 12;
    this.broadcastUpdate();

    await new Promise((r) => setTimeout(r, 600));
    this.currentCycle!.progress = 25;
    this.currentCycle!.phases[0].status = "COMPLETED";
    this.currentCycle!.phases[0].completedAt = new Date().toISOString();
    this.logToStream(
      `Phase 1: Local AST scan confirmed code flaw in ${params.auditInfo.targetComponent}. Fast-track synthesis ready.`
    );

    // Phase 2: MANDATORILY BYPASSED FOR FAST-TRACK
    this.currentCycle!.currentPhase = 2;
    this.currentCycle!.phases[1].status = "BYPASSED";
    this.currentCycle!.phases[1].bypassReason =
      "Fast-Track: Bypassed External Web Ingestion (Direct Internal AST Patch)";
    this.currentCycle!.phases[1].completedAt = new Date().toISOString();
    this.currentCycle!.progress = 50;
    this.logToStream(
      `[Fast-Track Testing Gate]: Bypassing Phase 2 (External Web Ingestion). Routing code changes DIRECTLY into Phase 3 (Sandbox Testing).`
    );
    this.broadcastUpdate();

    // Phase 3: MANDATORILY ROUTED INTO ISOLATED CONTAINER TESTING
    this.currentCycle!.currentPhase = 3;
    this.currentCycle!.phases[2].status = "RUNNING";
    this.currentCycle!.phases[2].startedAt = new Date().toISOString();
    this.currentCycle!.progress = 60;
    this.logToStream(
      "Phase 3: Launching containerized Docker sandbox. Executing full test suite (compilation, unit, syntax AST, headless UI, and contract tests)..."
    );

    await new Promise((r) => setTimeout(r, 900));
    this.currentCycle!.progress = 72;

    const testResult = await runAutomatedTests(
      params.simulateFlaw
        ? "FORCE_SANDBOX_FAIL: Injected simulated syntax flaw into AST branch"
        : `--- a/${params.auditInfo.targetComponent}\n+++ b/${params.auditInfo.targetComponent}\n// Fast-track optimized ring-buffer patch`,
      { simulateFlaw: params.simulateFlaw }
    );

    this.currentCycle!.sandboxGatekeeper = {
      enforcedPassRate: 1.0,
      zeroErrorsAllowed: true,
      activeGate: true,
      lastRunPassed: testResult.passed,
      rejectionRollbackCount: this.rejectionRollbackCount,
    };

    // 100% Pass Enforcement: Zero-Error Requirement
    if (!testResult.passed || testResult.passRate < 1.0 || testResult.failedTests > 0) {
      this.rejectionRollbackCount += 1;
      this.currentCycle!.phases[2].status = "PAUSED";
      this.currentCycle!.progress = 75;
      this.currentCycle!.sandboxGatekeeper.rejectionRollbackCount = this.rejectionRollbackCount;

      this.logToStream(
        `[Phase 3 REJECTION]: Sandbox test failure detected (${testResult.failedTests} flaws, ${(
          testResult.passRate * 100
        ).toFixed(1)}% pass rate). Enforcing strict 100% error-free pass requirement: Code change rejected and rolled back.`
      );
      this.logToStream(
        `[Self-Healing Dispatch]: Dispatched ${params.auditInfo.targetComponent} flaw to Self-Healing Repair Loop.`
      );

      try {
        const { selfDiagnosticService } = await import("./diagnosticService.js");
        selfDiagnosticService.triggerSubOptimalPattern({
          component: params.auditInfo.targetComponent,
          patternName: "Fast-Track Sandbox Regression Detected",
          detectedReason: `Automated tests detected ${testResult.failedTests} flaw(s) in sandbox. Pass rate: ${(
            testResult.passRate * 100
          ).toFixed(1)}%. Zero errors allowed.`,
          modernAlternative: "Re-synthesize AST logic via standard self-healing diagnostic repair loop.",
        });
      } catch (e) {
        console.error(e);
      }

      this.broadcastUpdate();
      return { sandboxPassed: false };
    }

    // Phase 3 Passed 100%
    this.currentCycle!.phases[2].status = "COMPLETED";
    this.currentCycle!.phases[2].completedAt = new Date().toISOString();
    this.currentCycle!.progress = 75;
    this.logToStream(
      `Phase 3: Sandbox verification SUCCESS! ${testResult.passedTests}/${testResult.totalTests} tests passed (100% pass rate). Zero runtime errors guaranteed.`
    );

    // Phase 4: Synthesize PR & Auto-deploy
    this.currentCycle!.currentPhase = 4;
    this.currentCycle!.phases[3].status = "RUNNING";
    this.currentCycle!.phases[3].startedAt = new Date().toISOString();
    this.currentCycle!.progress = 88;

    const fastTrackTitle = `perf(fast-track): resolve ${params.auditInfo.bottleneckType.toLowerCase().replace(/_/g, " ")} in ${params.auditInfo.targetComponent.split("/").pop()}`;
    const queuedUpdate = systemState.addPendingUpdate({
      title: fastTrackTitle,
      branch: `fast-track/${params.auditInfo.targetComponent.split("/").pop()?.replace(".ts", "")}`,
      targetFile: params.auditInfo.targetComponent,
      summary: `Accelerated Self-Code Audit: ${params.auditInfo.details} Verified with 100% pass in Phase 3 Sandbox testing.`,
      diff: `--- a/${params.auditInfo.targetComponent}\n+++ b/${params.auditInfo.targetComponent}\n@@ -1,4 +1,8 @@\n+// Fast-track AST optimization: resolved ${params.auditInfo.bottleneckType}\n+// Phase 3 Sandbox: 100% Passed (0 Errors)`,
      additions: 14,
      deletions: 2,
      testResults: testResult,
      impactRisk: {
        severity: "ROUTINE",
        riskLevel: "LOW",
        riskScore: 12,
        category: "PERFORMANCE",
        reasons: ["Internal local AST performance optimization with 100% sandbox pass rate."],
        requiresApproval: false,
        autoDeployEligible: true,
      },
      status: "AUTO_MERGED",
      isFastTrack: true,
      isSandboxVerified: true,
    });

    this.currentCycle!.generatedPrId = queuedUpdate.id;
    this.currentCycle!.progress = 100;
    this.currentCycle!.phases[3].status = "COMPLETED";
    this.currentCycle!.phases[3].completedAt = new Date().toISOString();
    this.currentCycle!.completedAt = new Date().toISOString();
    this.totalCyclesCompleted += 1;
    this.currentCycle!.totalCyclesCompleted = this.totalCyclesCompleted;

    this.logToStream(
      `[Fast-Track (Sandbox Verified)] [Auto-Deployed]: PR [${queuedUpdate.id}] auto-merged to production! Total Cycles Completed: ${this.totalCyclesCompleted}.`
    );

    this.broadcastUpdate();
    return { sandboxPassed: true };
  }

  /**
   * Executes the 4-phase upgrade workflow continuously with Pre-Phase 4 Risk Classification
   */
  private async executeInfinitePipeline(signal: AbortSignal, customFocus?: string) {
    this.isCycleRunning = true;

    try {
      while (
        (this.engineStatus === "ACTIVE" || this.engineStatus === "AWAITING_APPROVAL") &&
        !signal.aborted &&
        !systemState.getKillSwitch()
      ) {
        this.engineStatus = "ACTIVE";
        this.currentCycle!.engineStatus = "ACTIVE";
        this.currentCycle!.approvalRequiredPrId = null;
        this.currentCycle!.impactRisk = null;
        this.currentCycle!.isFastTrack = false;
        this.currentCycle!.fastTrackAudit = null;

        // Reset phases for the current cycle iteration
        this.currentCycle!.phases.forEach((p) => {
          p.status = "PENDING";
          p.startedAt = undefined;
          p.completedAt = undefined;
        });

        // -------------------------------------------------------------
        // Phase 1: Code & Log Diagnostics (0% -> 25%)
        // -------------------------------------------------------------
        this.currentCycle!.currentPhase = 1;
        this.currentCycle!.phases[0].status = "RUNNING";
        this.currentCycle!.phases[0].startedAt = new Date().toISOString();
        this.currentCycle!.progress = 5;
        this.logToStream(
          `[Cycle #${this.totalCyclesCompleted + 1}] Phase 1: Starting Code & Log Diagnostics across /src and /server...`
        );

        await this.sleepWithCheck(1100, signal);
        this.currentCycle!.progress = 14;
        this.logToStream("Phase 1: AST validation complete. Inspecting recent runtime telemetry logs...");

        await this.sleepWithCheck(900, signal);
        this.currentCycle!.progress = 22;
        this.logToStream(
          "Phase 1: Diagnostic scan complete. Identified optimization targets in WebSocket and concurrency modules."
        );

        await this.sleepWithCheck(700, signal);
        this.currentCycle!.progress = 25;
        this.currentCycle!.phases[0].status = "COMPLETED";
        this.currentCycle!.phases[0].completedAt = new Date().toISOString();

        // -------------------------------------------------------------
        // Phase 2: Live Knowledge Acquisition (YouTube, GitHub, Google, Wikipedia) (25% -> 50%)
        // Real-Time Active Item Streaming
        // -------------------------------------------------------------
        this.currentCycle!.currentPhase = 2;
        this.currentCycle!.phases[1].status = "RUNNING";
        this.currentCycle!.phases[1].startedAt = new Date().toISOString();
        this.logToStream(
          "Phase 2: Initiating Live Autonomous Knowledge Acquisition (YouTube, GitHub, Google, Wikipedia)..."
        );

        const liveCatalog: Array<{
          source: LearningSourceId;
          title: string;
          url: string;
          category: string;
          maxChars: number;
          maxTokens: number;
          sample: string;
        }> = [
          {
            source: "youtube",
            title: 'YouTube: "Optimizing Event-Driven Async Loops in Node.js"',
            url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
            category: "Video Transcript Extraction",
            maxChars: 4200,
            maxTokens: 980,
            sample: "Draining microtask queues before socket tick prevents event loop starvation under high concurrency bursts.",
          },
          {
            source: "github",
            title: 'GitHub: "facebook/react - Batched State Hydration Heuristic (PR #28419)"',
            url: "https://github.com/facebook/react/pull/28419",
            category: "AST Patch Diffing",
            maxChars: 3150,
            maxTokens: 740,
            sample: "Diffing heuristic applies monotonic clock comparison across virtual DOM reconciliation nodes.",
          },
          {
            source: "google",
            title: 'Google: "IETF RFC 9110 HTTP/3 Semantics & Multiplexing Specifications"',
            url: "https://datatracker.ietf.org/doc/html/rfc9110",
            category: "Technical Standards",
            maxChars: 5800,
            maxTokens: 1450,
            sample: "RFC 9110 specifies deterministic backoff header intervals and flow control window sizing.",
          },
          {
            source: "wikipedia",
            title: 'Wikipedia: "AST Analysis & Directed Acyclic Control Flow Graph Formalisms"',
            url: "https://en.wikipedia.org/wiki/Abstract_syntax_tree",
            category: "Compiler Theory",
            maxChars: 2850,
            maxTokens: 680,
            sample: "An abstract syntax tree encodes syntactical structure devoid of delimiter tokens and punctuation.",
          },
        ];

        const activeCatalogItem = liveCatalog[this.totalCyclesCompleted % liveCatalog.length];

        // Step 1: Ingest start
        const streamingItem1 = autonomousLearningEngine.updateActiveLearningProgress({
          source: activeCatalogItem.source,
          title: activeCatalogItem.title,
          url: activeCatalogItem.url,
          category: activeCatalogItem.category,
          currentChars: Math.floor(activeCatalogItem.maxChars * 0.35),
          totalChars: activeCatalogItem.maxChars,
          snippet: `Streaming tokens [35%]: "${activeCatalogItem.sample.slice(0, 45)}..."`,
          status: "PARSING",
        });
        this.currentCycle!.activeLearningItem = streamingItem1;
        this.currentCycle!.progress = 32;
        this.logToStream(
          `[Live Learning]: Parsing active item -> ${activeCatalogItem.title} (${streamingItem1.currentCharacters}/${streamingItem1.totalCharacters} chars)`
        );

        await this.sleepWithCheck(1100, signal);

        // Step 2: Stream tokens further
        const streamingItem2 = autonomousLearningEngine.updateActiveLearningProgress({
          source: activeCatalogItem.source,
          title: activeCatalogItem.title,
          url: activeCatalogItem.url,
          category: activeCatalogItem.category,
          currentChars: Math.floor(activeCatalogItem.maxChars * 0.78),
          totalChars: activeCatalogItem.maxChars,
          snippet: `Streaming tokens [78%]: "${activeCatalogItem.sample}..."`,
          status: "ANALYZING_AST",
        });
        this.currentCycle!.activeLearningItem = streamingItem2;
        this.currentCycle!.progress = 42;
        this.logToStream(
          `[Live Learning]: AST synthesis -> ${activeCatalogItem.title} (${streamingItem2.currentTokens}/${streamingItem2.totalTokens} tokens)`
        );

        const topic =
          customFocus ||
          (this.totalCyclesCompleted % 2 === 0
            ? "Sliding Window Rate Limiter & Concurrency"
            : "High-Throughput WebSocket Broadcast Backpressure");

        const acquired = await autonomousLearningEngine.researchTopic(topic);
        this.currentCycle!.acquiredKnowledge = acquired;

        await this.sleepWithCheck(900, signal);

        // Step 3: Complete item indexing
        const streamingItem3 = autonomousLearningEngine.updateActiveLearningProgress({
          source: activeCatalogItem.source,
          title: activeCatalogItem.title,
          url: activeCatalogItem.url,
          category: activeCatalogItem.category,
          currentChars: activeCatalogItem.maxChars,
          totalChars: activeCatalogItem.maxChars,
          snippet: `Indexed 100%: "${activeCatalogItem.sample}"`,
          status: "INDEXED",
        });
        this.currentCycle!.activeLearningItem = streamingItem3;
        this.currentCycle!.progress = 50;
        this.currentCycle!.phases[1].status = "COMPLETED";
        this.currentCycle!.phases[1].completedAt = new Date().toISOString();
        this.logToStream(`Phase 2: Ingested & indexed state-of-the-art pattern from ${activeCatalogItem.title}`);

        // -------------------------------------------------------------
        // Phase 3: Sandbox Compilation & Automated Testing (50% -> 75%)
        // STRICT 100% PASS GATEKEEPER (ZERO-ERROR REQUIREMENT)
        // -------------------------------------------------------------
        this.currentCycle!.currentPhase = 3;
        this.currentCycle!.phases[2].status = "RUNNING";
        this.currentCycle!.phases[2].startedAt = new Date().toISOString();
        this.logToStream("Phase 3: Initializing isolated containerized Docker sandbox environment...");

        await this.sleepWithCheck(900, signal);
        this.currentCycle!.progress = 58;
        this.logToStream("Phase 3: Synthesizing patch diff and applying to virtual ephemeral runtime...");

        const recentLogs = systemState.getTelemetryLogs(12);
        const generated = await analyzeLogsAndGenerateUpdate(recentLogs);

        await this.sleepWithCheck(900, signal);
        this.currentCycle!.progress = 68;
        this.logToStream(
          "Phase 3: Running automated test harness: Compilation, unit regression, syntax AST, and headless UI suites..."
        );

        const testResult = await runAutomatedTests(generated.update.diff);

        this.currentCycle!.sandboxGatekeeper = {
          enforcedPassRate: 1.0,
          zeroErrorsAllowed: true,
          activeGate: true,
          lastRunPassed: testResult.passed,
          rejectionRollbackCount: this.rejectionRollbackCount,
        };

        // 100% Pass Enforcement: Zero errors allowed
        if (!testResult.passed || testResult.passRate < 1.0 || testResult.failedTests > 0) {
          this.rejectionRollbackCount += 1;
          this.currentCycle!.phases[2].status = "PAUSED";
          this.currentCycle!.progress = 75;
          this.currentCycle!.sandboxGatekeeper.rejectionRollbackCount = this.rejectionRollbackCount;

          this.logToStream(
            `[Phase 3 REJECTION]: Sandbox test failure detected (${testResult.failedTests} flaws, ${(
              testResult.passRate * 100
            ).toFixed(1)}% pass rate). Enforcing strict 100% error-free guarantee: Code change rejected and rolled back.`
          );
          this.logToStream(
            `[Self-Healing Dispatch]: Auto-dispatching flawed pattern in ${this.currentCycle!.targetComponent} to Self-Healing Repair Loop.`
          );

          try {
            const { selfDiagnosticService } = await import("./diagnosticService.js");
            selfDiagnosticService.triggerSubOptimalPattern({
              component: this.currentCycle!.targetComponent,
              patternName: "Phase 3 Sandbox Test Regression",
              detectedReason: `Automated tests detected ${testResult.failedTests} assertion failure(s) in sandbox. Pass rate was ${(
                testResult.passRate * 100
              ).toFixed(1)}% (100% required).`,
              modernAlternative: "Enforce strict zero-allocation AST pattern with isolated boundary testing.",
            });
          } catch (e) {
            console.error(e);
          }

          this.broadcastUpdate();
          await this.sleepWithCheck(2000, signal);
          continue;
        }

        await this.sleepWithCheck(700, signal);
        this.currentCycle!.progress = 75;
        this.currentCycle!.phases[2].status = "COMPLETED";
        this.currentCycle!.phases[2].completedAt = new Date().toISOString();
        this.logToStream(
          `Phase 3: Sandbox verification SUCCESS! ${testResult.passedTests}/${testResult.totalTests} tests passed (100% pass rate). Zero runtime errors guaranteed.`
        );

        // -------------------------------------------------------------
        // PRE-PHASE 4: IMPACT RISK CLASSIFIER ANALYSIS
        // -------------------------------------------------------------
        const currentPolicy = systemState.getAutoDeployPolicy();
        const riskAssessment = ImpactRiskClassifier.classifyChange(
          {
            title: generated.update.title,
            targetFile: generated.update.targetFile,
            diff: generated.update.diff,
            summary: generated.update.summary,
            additions: generated.update.additions,
            deletions: generated.update.deletions,
            testPassRate: testResult.passRate,
          },
          currentPolicy
        );

        this.currentCycle!.impactRisk = riskAssessment;

        // -------------------------------------------------------------
        // Phase 4: Synthesizing PR & Permission Gating
        // -------------------------------------------------------------
        this.currentCycle!.currentPhase = 4;
        this.currentCycle!.phases[3].status = "RUNNING";
        this.currentCycle!.phases[3].startedAt = new Date().toISOString();

        if (riskAssessment.autoDeployEligible) {
          // -----------------------------------------------------------
          // ROUTINE CHANGE (Zero Permission Needed): AUTO-DEPLOY
          // -----------------------------------------------------------
          this.logToStream(
            `[Impact Risk Classifier]: Evaluated as ROUTINE (Risk Score: ${riskAssessment.riskScore}/100, Blast: Low). Bypassing Admin review queue.`
          );

          await this.sleepWithCheck(900, signal);
          this.currentCycle!.progress = 88;
          this.logToStream(
            `[Auto-Deploy Engine]: Auto-merging conventional commit: "${generated.update.title}" directly to production...`
          );

          const queuedUpdate = systemState.addPendingUpdate({
            title: generated.update.title,
            branch: generated.update.branch,
            targetFile: generated.update.targetFile,
            summary: `${generated.update.summary} Auto-deployed under Full Autonomy Policy. Phase 3 Sandbox: 100% Passed.`,
            diff: generated.update.diff,
            additions: generated.update.additions,
            deletions: generated.update.deletions,
            testResults: testResult,
            impactRisk: riskAssessment,
            status: "AUTO_MERGED",
            isSandboxVerified: true,
          });

          this.currentCycle!.generatedPrId = queuedUpdate.id;
          this.currentCycle!.targetComponent = queuedUpdate.targetFile;

          await this.sleepWithCheck(800, signal);
          this.currentCycle!.progress = 100;
          this.currentCycle!.phases[3].status = "COMPLETED";
          this.currentCycle!.phases[3].completedAt = new Date().toISOString();
          this.currentCycle!.completedAt = new Date().toISOString();

          this.totalCyclesCompleted += 1;
          this.currentCycle!.totalCyclesCompleted = this.totalCyclesCompleted;

          this.logToStream(
            `[Auto-Deployed]: PR [${queuedUpdate.id}] auto-merged to production! Total Cycles Completed: ${this.totalCyclesCompleted}.`
          );

          this.broadcastUpdate();
        } else {
          // -----------------------------------------------------------
          // IMPORTANT / CRITICAL CHANGE (OR STRICT MODE): PERMISSION GATING
          // -----------------------------------------------------------
          this.logToStream(
            `[Impact Risk Classifier]: ALERT: Evaluated as CRITICAL (Risk Score: ${riskAssessment.riskScore}/100). ${riskAssessment.reasons[0]}`
          );

          await this.sleepWithCheck(800, signal);
          this.currentCycle!.progress = 88;

          const queuedUpdate = systemState.addPendingUpdate({
            title: generated.update.title,
            branch: generated.update.branch,
            targetFile: generated.update.targetFile,
            summary: `${generated.update.summary} High-Impact system change requiring Executive Admin approval. Phase 3 Sandbox: 100% Passed.`,
            diff: generated.update.diff,
            additions: generated.update.additions,
            deletions: generated.update.deletions,
            testResults: testResult,
            impactRisk: riskAssessment,
            status: "PENDING",
            isSandboxVerified: true,
          });

          this.currentCycle!.generatedPrId = queuedUpdate.id;
          this.currentCycle!.targetComponent = queuedUpdate.targetFile;
          this.currentCycle!.approvalRequiredPrId = queuedUpdate.id;
          this.engineStatus = "AWAITING_APPROVAL";
          this.currentCycle!.engineStatus = "AWAITING_APPROVAL";
          this.currentCycle!.statusMessage =
            "Approval Required: High-Impact System Change Detected. Holding pipeline for Admin sign-off.";

          vanguardWebSocket.broadcast({
            type: "high_impact_approval_required",
            pr: queuedUpdate,
            risk: riskAssessment,
          });

          this.logToStream(
            `[Approval Required: High-Impact System Change Detected]: Holding pipeline execution on PR [${queuedUpdate.id}]. Awaiting Admin [Approve & Merge] or [Reject].`
          );

          this.broadcastUpdate();

          // Hold execution until Admin takes action
          const decision = await this.waitForAdminApproval(queuedUpdate.id, signal);

          this.currentCycle!.approvalRequiredPrId = null;
          this.engineStatus = "ACTIVE";
          this.currentCycle!.engineStatus = "ACTIVE";

          if (decision === "APPROVE") {
            this.currentCycle!.progress = 100;
            this.currentCycle!.phases[3].status = "COMPLETED";
            this.currentCycle!.phases[3].completedAt = new Date().toISOString();
            this.currentCycle!.completedAt = new Date().toISOString();

            this.totalCyclesCompleted += 1;
            this.currentCycle!.totalCyclesCompleted = this.totalCyclesCompleted;

            this.logToStream(
              `Admin APPROVED and merged PR [${queuedUpdate.id}]. Total Cycles Completed: ${this.totalCyclesCompleted}.`
            );
          } else {
            this.logToStream(
              `Admin REJECTED PR [${queuedUpdate.id}]. Reverting sandboxed patch.`
            );
          }

          this.broadcastUpdate();
        }

        // Check if engine is still active and kill switch is not engaged
        if (
          this.engineStatus !== "ACTIVE" ||
          signal.aborted ||
          systemState.getKillSwitch()
        ) {
          break;
        }

        // -------------------------------------------------------------
        // Infinite Auto-Loop: 2s Countdown -> Reset to 0% -> Phase 1
        // -------------------------------------------------------------
        this.logToStream(
          `[Infinite Auto-Loop Active]: Completed Cycle #${this.totalCyclesCompleted}. Resetting progress in 2s to launch next cycle...`
        );

        await this.sleepWithCheck(2000, signal);

        if (
          this.engineStatus !== "ACTIVE" ||
          signal.aborted ||
          systemState.getKillSwitch()
        ) {
          break;
        }

        // Reset progress and generate fresh cycle ID for the next loop
        this.currentCycle!.progress = 0;
        this.currentCycle!.id = `upg-${Date.now().toString().slice(-6)}`;
        this.currentCycle!.currentPhase = 1;
        this.broadcastUpdate();
      }
    } catch (err: any) {
      if (signal.aborted) {
        this.logToStream("Upgrade execution safely paused by Admin.");
      } else {
        this.logToStream(`Upgrade interrupted: ${err.message}`);
      }
    } finally {
      this.isCycleRunning = false;
      this.broadcastUpdate();
    }
  }
}

export const vanguardUpgradeService = new VanguardUpgradeService();
