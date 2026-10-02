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
  status: "PENDING" | "APPROVED" | "REJECTED";
  testResults: AutomatedTestResult;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
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
  lastHourlyTriggerAt: string | null;
  totalTriggersRun: number;
  tokensUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCalls: number;
  };
}
