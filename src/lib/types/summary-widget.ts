import type { OpenStatusGroup } from "~/lib/issues/status";
import type { IssuePriority, IssueSeverity } from "./database";

/**
 * Counts for the issue-list Summary Widgets (issue-widgets §2–§5). Every widget
 * summarizes the same population: every issue, open or closed, on the host's
 * On the Floor machines (§2.2).
 */
export interface IssueListSummary {
  /** Open issues in the population. */
  open: number;
  /** Open issues in each open status group. */
  byStatusGroup: Record<OpenStatusGroup, number>;
  /** Open issues of each severity. */
  bySeverity: Record<IssueSeverity, number>;
  /** Open issues of each priority. */
  byPriority: Record<IssuePriority, number>;
}
