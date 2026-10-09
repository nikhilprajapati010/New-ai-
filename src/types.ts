export type UserRole = "ADMIN" | "USER";

export type ModelPriorityId = "gemini-1.5-pro" | "gemini-1.5-flash" | "gemini-1.5-flash-8b";

export interface ModelTierConfig {
  id: ModelPriorityId;
  name: string;
  priority: number;
  apiModel: string;
  description: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string;
}

export interface TestResultDetail {
  suite: string;
  name: string;
  durationMs: number;
  status: "PASSED" | "FAILED";
  assertions: number;
}

export interface AutomatedTestResult {
  passed: boolean;
  passRate: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTimeMs: number;
  sandboxId: string;
  runtimeVersion: string;
  suites: TestResultDetail[];
  summary: string;
  hasZeroErrorGuarantee?: boolean;
}

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

export interface PendingUpdate {
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

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "TEST" | "EVENT";
  source: string;
  message: string;
  tokensUsed?: number;
}

export interface TerminalLogEvent {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "TEST" | "EVENT";
  source: string;
  message: string;
  metadata?: any;
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

export type UpgradeEngineStatus = "IDLE" | "ACTIVE" | "PAUSED" | "COMPLETED" | "AWAITING_APPROVAL";

export interface UpgradePhaseInfo {
  phaseNumber: 1 | 2 | 3 | 4;
  name: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PAUSED" | "BYPASSED";
  description: string;
  startedAt?: string;
  completedAt?: string;
  bypassReason?: string;
}

export type LearningSourceId = "github" | "google" | "wikipedia" | "youtube";

export interface ActiveLearningItem {
  source: LearningSourceId;
  title: string;
  url: string;
  category: string;
  currentCharacters: number;
  totalCharacters: number;
  currentTokens: number;
  totalTokens: number;
  streamingSnippet: string;
  status: "FETCHING" | "PARSING" | "ANALYZING_AST" | "INDEXED";
  updatedAt: string;
}

export interface FastTrackAuditInfo {
  id: string;
  detectedAt: string;
  targetComponent: string;
  bottleneckType: "AST_CONCURRENCY" | "MEMORY_LEAK_RISK" | "UNHANDLED_REJECTION" | "ASYNC_EVENT_LOOP" | "SYNTAX_FLAW";
  details: string;
  bypassedPhase2: boolean;
  mandatedPhase3: boolean;
  sandboxPassed: boolean;
}

export interface SandboxGatekeeperStatus {
  enforcedPassRate: number;
  zeroErrorsAllowed: boolean;
  activeGate: boolean;
  lastRunPassed: boolean;
  rejectionRollbackCount: number;
}

export interface KnowledgeArtifact {
  id: string;
  source: LearningSourceId;
  title: string;
  snippet: string;
  url: string;
  tags: string[];
  relevanceScore: number;
  timestamp: string;
  appliedInPrId?: string;
}

export interface UpgradeCycleState {
  id: string;
  engineStatus: UpgradeEngineStatus;
  progress: number;
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

export interface LearningSourceConfig {
  id: LearningSourceId;
  name: string;
  category: string;
  enabled: boolean;
  status: "READY" | "SCANNING" | "SYNCED" | "PAUSED";
  description: string;
  itemsIndexed: number;
  lastScanAt: string;
}

export interface KnowledgeMetrics {
  repositoriesScanned: number;
  prsParsed: number;
  transcriptsIngested: number;
  pagesScraped: number;
  totalKnowledgeNodes: number;
  lastActiveObserverTimestamp: string;
}

export interface KnowledgeStreamTickerItem {
  id: string;
  timestamp: string;
  source: LearningSourceId;
  action: string;
  details: string;
  targetFramework: string;
}

export type SystemHealthStatus =
  | "OPTIMAL"
  | "SUB_OPTIMAL_DETECTED"
  | "HEALING_IN_PROGRESS";

export interface DiagnosticIssue {
  component: string;
  patternName: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  detectedReason: string;
  modernAlternative: string;
  sourceReference: string;
  timestamp: string;
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ALERT" | "HEALED";
  message: string;
  component?: string;
}

export interface DiagnosticStatusResponse {
  health: SystemHealthStatus;
  statusHeadline: string;
  lastScanAt: string;
  totalFilesScanned: number;
  activeIssue: DiagnosticIssue | null;
  historyLogs: DiagnosticLog[];
  autoTriggerCount: number;
}

export interface FastCodeAuditStatus {
  isScanning: boolean;
  lastAuditAt: string;
  localFilesAuditedCount: number;
  totalAuditsCompleted: number;
  activeAudit: FastTrackAuditInfo | null;
  auditHistory: FastTrackAuditInfo[];
  sandboxGatekeeperEnforced: boolean;
  zeroErrorsAllowed: boolean;
  auditRateFilesPerSec: number;
}

export interface FileNode {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  lines?: number;
  extension?: string;
  updatedAt?: string;
  children?: FileNode[];
}

export interface FileSystemStats {
  totalFiles: number;
  totalLinesOfCode: number;
  typescriptFiles: number;
  reactComponents: number;
  serverServices: number;
  scannedAt: string;
}


