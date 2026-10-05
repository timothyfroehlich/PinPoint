import type { IssuePriority, IssueSeverity, IssueStatus } from "./database";

/**
 * Counts for the issue-list Summary Widgets (issue-widgets §2–§5). Every widget
 * summarizes the same population: every issue, open or closed, on the host's
 * On the Floor machines (§2.2).
 */
export interface IssueListSummary {
  /** Open issues in the population. */
  open: number;
  /** Issues of each status; closed statuses included. */
  byStatus: Record<IssueStatus, number>;
  /** Open issues of each severity. */
  bySeverity: Record<IssueSeverity, number>;
  /** Open issues of each priority. */
  byPriority: Record<IssuePriority, number>;
}
