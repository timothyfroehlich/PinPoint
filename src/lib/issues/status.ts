export type IssueStatus = "new" | "in_progress" | "resolved";
export type IssueSeverity = "minor" | "playable" | "unplayable";

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
    new: "bg-surface-variant text-on-surface-variant border-outline-variant",
    in_progress:
      "bg-primary-container text-on-primary-container border-primary",
    resolved: "bg-success-container text-on-success-container border-success",
  };
  return styles[status];
}

/**
 * Get CSS classes for issue severity badge
 * Uses Material Design 3 color system from globals.css
 */
export function getIssueSeverityStyles(severity: IssueSeverity): string {
  const styles: Record<IssueSeverity, string> = {
    minor: "bg-surface-variant text-on-surface-variant border-outline-variant",
    playable: "bg-warning-container text-on-warning-container border-warning",
    unplayable: "bg-error-container text-on-error-container border-error",
  };
  return styles[severity];
}
