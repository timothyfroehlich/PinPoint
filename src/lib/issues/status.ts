export type IssueStatus = "new" | "in_progress" | "resolved";
export type IssueSeverity = "minor" | "playable" | "unplayable";

/**
 * Type guard for IssueStatus
 * Validates that a value is a valid issue status
 */
export function isIssueStatus(value: unknown): value is IssueStatus {
  return (
    typeof value === "string" &&
    ["new", "in_progress", "resolved"].includes(value)
  );
}

/**
 * Type guard for IssueSeverity
 * Validates that a value is a valid issue severity
 */
export function isIssueSeverity(value: unknown): value is IssueSeverity {
  return (
    typeof value === "string" &&
    ["minor", "playable", "unplayable"].includes(value)
  );
}

/**
 * Get display label for issue status
 */
export function getIssueStatusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    new: "New",
    in_progress: "In Progress",
    resolved: "Resolved",
  };
  return labels[status];
}

/**
 * Get display label for issue severity
 */
export function getIssueSeverityLabel(severity: IssueSeverity): string {
  const labels: Record<IssueSeverity, string> = {
    minor: "Minor",
    playable: "Playable",
    unplayable: "Unplayable",
  };
  return labels[severity];
}

/**
 * Get CSS classes for issue status badge
 * Uses Material Design 3 color system from globals.css
 */
export function getIssueStatusStyles(status: IssueStatus): string {
  const styles: Record<IssueStatus, string> = {
    new: "bg-status-new/20 text-status-new border-status-new glow-primary",
    in_progress:
      "bg-status-in-progress/20 text-status-in-progress border-status-in-progress glow-secondary",
    resolved:
      "bg-status-resolved/20 text-status-resolved border-status-resolved",
  };
  return styles[status];
}

/**
 * Get CSS classes for issue severity badge
 * Uses Material Design 3 color system from globals.css
 */
export function getIssueSeverityStyles(severity: IssueSeverity): string {
  const styles: Record<IssueSeverity, string> = {
    minor: "bg-muted/50 text-muted-foreground border-border",
    playable: "bg-warning/20 text-warning border-warning glow-warning",
    unplayable:
      "bg-status-unplayable/20 text-status-unplayable border-status-unplayable glow-destructive",
  };
  return styles[severity];
}
