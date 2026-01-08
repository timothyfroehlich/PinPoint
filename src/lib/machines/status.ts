import type { IssueStatus, IssueSeverity } from "~/lib/types";
import { CLOSED_STATUSES } from "~/lib/issues/status";

export type MachineStatus = "unplayable" | "needs_service" | "operational";

export interface IssueForStatus {
  status: IssueStatus;
  severity: IssueSeverity;
}

/**
 * Derive machine status from its issues
 *
 * Logic:
 * - `unplayable`: At least one unplayable issue that's not closed
 * - `needs_service`: At least one non-closed issue (major/minor/cosmetic), or a major issue
 * - `operational`: No open issues
 */
export function deriveMachineStatus(issues: IssueForStatus[]): MachineStatus {
  // Filter to only open issues (not in CLOSED_STATUSES)
  const openIssues = issues.filter(
    (issue) => !(CLOSED_STATUSES as readonly string[]).includes(issue.status)
  );

  // No open issues = operational
  if (openIssues.length === 0) {
    return "operational";
  }

  // Check for unplayable issues
  const hasUnplayable = openIssues.some(
    (issue) => issue.severity === "unplayable"
  );
  if (hasUnplayable) {
    return "unplayable";
  }

  // Has open issues but none are unplayable = needs service
  return "needs_service";
}

/**
 * Get display label for machine status
 */
export function getMachineStatusLabel(status: MachineStatus): string {
  const labels: Record<MachineStatus, string> = {
    operational: "Operational",
    needs_service: "Needs Service",
    unplayable: "Unplayable",
  };
  return labels[status];
}

/**
 * Get CSS classes for machine status badge
 * Uses Material Design 3 color system from globals.css
 */
export function getMachineStatusStyles(status: MachineStatus): string {
  const styles: Record<MachineStatus, string> = {
    operational:
      "bg-success-container text-on-success-container border-success",
    needs_service:
      "bg-warning-container text-on-warning-container border-warning",
    unplayable: "bg-error-container text-on-error-container border-error",
  };
  return styles[status];
}
