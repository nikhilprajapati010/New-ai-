import { AutoDeployPolicy, ImpactRiskAssessment } from "./state.js";

export class ImpactRiskClassifier {
  /**
   * Evaluates synthesized code diff, file boundaries, and commit metadata
   * to determine whether the patch is a Routine fix or an Important/Critical change.
   */
  public static classifyChange(
    params: {
      title: string;
      targetFile: string;
      diff: string;
      summary: string;
      additions: number;
      deletions: number;
      testPassRate: number;
    },
    policy: AutoDeployPolicy = "FULL_AUTONOMY"
  ): ImpactRiskAssessment {
    const { title, targetFile, diff, summary, additions, deletions, testPassRate } = params;

    const lowerTarget = targetFile.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerDiff = diff.toLowerCase();
    const lowerSummary = summary.toLowerCase();

    const reasons: string[] = [];
    let severity: "ROUTINE" | "CRITICAL" = "ROUTINE";
    let riskLevel: "LOW" | "HIGH" = "LOW";
    let riskScore = 15;
    let category: ImpactRiskAssessment["category"] = "BUG_FIX";

    // 1. Check for Authentication or Security changes
    const isSecurityOrAuth =
      lowerTarget.includes("auth") ||
      lowerTarget.includes("security") ||
      lowerTarget.includes("jwt") ||
      lowerTarget.includes("oauth") ||
      lowerTitle.includes("auth") ||
      lowerTitle.includes("security") ||
      lowerTitle.includes("rbac") ||
      lowerDiff.includes("requireadmin") ||
      lowerDiff.includes("userrole") ||
      lowerDiff.includes("password") ||
      lowerDiff.includes("secret") ||
      lowerDiff.includes("permission");

    if (isSecurityOrAuth) {
      severity = "CRITICAL";
      riskLevel = "HIGH";
      riskScore = 88;
      category = "SECURITY";
      reasons.push("Modifies core authentication, authorization, or security validation boundaries.");
    }

    // 2. Check for Database Schema Migrations or SQL
    const isDatabaseOrSchema =
      lowerTarget.includes("db/") ||
      lowerTarget.includes("schema") ||
      lowerTarget.includes("migration") ||
      lowerDiff.includes("create table") ||
      lowerDiff.includes("alter table") ||
      lowerDiff.includes("drop table") ||
      lowerDiff.includes("pgtable") ||
      lowerTitle.includes("schema") ||
      lowerTitle.includes("migration");

    if (isDatabaseOrSchema) {
      severity = "CRITICAL";
      riskLevel = "HIGH";
      riskScore = 92;
      category = "DATABASE_SCHEMA";
      reasons.push("Database schema modification or persistent storage migration detected.");
    }

    // 3. Check for New External Dependencies (package.json)
    const isDependencyChange =
      lowerTarget.includes("package.json") ||
      lowerDiff.includes('"dependencies":') ||
      lowerDiff.includes('"devdependencies":');

    if (isDependencyChange) {
      severity = "CRITICAL";
      riskLevel = "HIGH";
      riskScore = 82;
      category = "DEPENDENCIES";
      reasons.push("Modifies package.json or introduces external runtime dependencies.");
    }

    // 4. Check for Breaking API Route Changes
    const isBreakingApi =
      lowerTarget.includes("server/api") &&
      (lowerDiff.includes("app.delete") ||
        lowerDiff.includes("status(404)") ||
        lowerDiff.includes("status(401)") ||
        lowerDiff.includes("break") ||
        lowerTitle.includes("breaking"));

    if (isBreakingApi && severity !== "CRITICAL") {
      severity = "CRITICAL";
      riskLevel = "HIGH";
      riskScore = 78;
      category = "API_BREAKING";
      reasons.push("Potential breaking route signature or contract change in public API surface.");
    }

    // 5. If not critical, categorize as Routine/Minor
    if (severity === "ROUTINE") {
      if (
        lowerTarget.includes("eventbatcher") ||
        lowerTarget.includes("ratelimiter") ||
        lowerTitle.includes("performance") ||
        lowerSummary.includes("latency") ||
        lowerSummary.includes("concurrency")
      ) {
        category = "PERFORMANCE";
        riskScore = 18;
        reasons.push("Internal throughput or latency optimization with localized component blast radius.");
      } else if (lowerTitle.includes("fix") || lowerTitle.includes("patch")) {
        category = "BUG_FIX";
        riskScore = 12;
        reasons.push("Bug remediation resolving edge-case error without structural interface changes.");
      } else {
        category = "REFACTOR";
        riskScore = 15;
        reasons.push("Non-breaking internal refactoring with verified sandbox test pass.");
      }
    }

    // 6. Test Pass Rate verification
    if (testPassRate < 1.0) {
      severity = "CRITICAL";
      riskLevel = "HIGH";
      riskScore = Math.max(riskScore, 90);
      reasons.push(`Sandbox coverage regression detected: ${(testPassRate * 100).toFixed(0)}% pass rate.`);
    }

    // 7. Policy enforcement
    const isRoutineAndPassing = severity === "ROUTINE" && testPassRate >= 1.0;
    const autoDeployEligible = isRoutineAndPassing && policy === "FULL_AUTONOMY";
    const requiresApproval = !autoDeployEligible;

    if (!autoDeployEligible) {
      if (policy === "STRICT_MODE") {
        reasons.push("Strict Mode Policy is active: all system changes require explicit Admin sign-off.");
      } else if (severity === "CRITICAL") {
        reasons.push("High-Impact severity threshold reached: Admin verification required before production deployment.");
      }
    }

    return {
      severity,
      riskLevel,
      riskScore,
      category,
      reasons,
      requiresApproval,
      autoDeployEligible,
    };
  }
}
