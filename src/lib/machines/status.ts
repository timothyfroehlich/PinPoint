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
 * - `unplayable`: At least one open issue with severity `unplayable`.
 * - `needs_service`: At least one open issue with severity `major` (and no `unplayable` issues).
 * - `operational`: No open issues, or only open issues with `minor` or `cosmetic` severity.
 */
export function deriveMachineStatus(issues: IssueForStatus[]): MachineStatus {
  // Filter to only open issues (not in CLOSED_STATUSES)
  const openIssues = issues.filter(
    (issue) => !(CLOSED_STATUSES as readonly string[]).includes(issue.status),
  );

  const severities = new Set(openIssues.map((issue) => issue.severity));

  if (severities.has("unplayable")) {
    return "unplayable";
  }
  if (severities.has("major")) {
    return "needs_service";
  }

  return "operational";
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
