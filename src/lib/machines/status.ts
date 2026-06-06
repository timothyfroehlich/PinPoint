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
    (issue) => !(CLOSED_STATUSES as readonly string[]).includes(issue.status)
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

/** Sort rank for issue severities — higher is worse. */
export const SEVERITY_RANK: Record<IssueSeverity, number> = {
  cosmetic: 0,
  minor: 1,
  major: 2,
  unplayable: 3,
};

/** Sort rank for derived machine statuses — higher is worse. */
export const MACHINE_STATUS_RANK: Record<MachineStatus, number> = {
  operational: 0,
  needs_service: 1,
  unplayable: 2,
};

/**
 * The highest-ranked severity among a machine's OPEN issues, or null when
 * nothing is open. Closed issues never count (mirrors deriveMachineStatus).
 */
export function worstOpenSeverity(
  issues: IssueForStatus[]
): IssueSeverity | null {
  let worst: IssueSeverity | null = null;
  for (const issue of issues) {
    if ((CLOSED_STATUSES as readonly string[]).includes(issue.status)) continue;
    if (
      worst === null ||
      SEVERITY_RANK[issue.severity] > SEVERITY_RANK[worst]
    ) {
      worst = issue.severity;
    }
  }
  return worst;
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
    unplayable: "bg-destructive/10 text-red-400 border-destructive/20",
  };
  return styles[status];
}
