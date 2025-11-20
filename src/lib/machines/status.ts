/**
 * Machine Status Derivation
 *
 * Derives machine operational status from open issues.
 * Status hierarchy: unplayable > needs_service > operational
 */

export type MachineStatus = "unplayable" | "needs_service" | "operational";

export interface IssueForStatus {
  status: "new" | "in_progress" | "resolved";
  severity: "minor" | "playable" | "unplayable";
}

/**
 * Derive machine status from its issues
 *
 * Logic:
 * - `unplayable`: At least one unplayable issue that's not resolved
 * - `needs_service`: At least one playable/minor issue that's not resolved, no unplayable
 * - `operational`: No open issues
 *
 * @param issues - Array of issues for the machine
 * @returns Derived machine status
 */
export function deriveMachineStatus(issues: IssueForStatus[]): MachineStatus {
  // Filter to only open issues (not resolved)
  const openIssues = issues.filter((issue) => issue.status !== "resolved");

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
      "bg-status-operational text-status-operational-foreground border-status-operational",
    needs_service:
      "bg-warning-container text-on-warning-container border-warning", // Kept for type safety with existing MachineStatus
    unplayable: "bg-destructive/10 text-destructive border-destructive",
  };
  return styles[status];
}
