import type { IssuePriority, IssueSeverity, IssueStatus } from "./database";

/**
 * Which records a Summary Widget summarizes (widgets spec §1, §3): the host's
 * whole scope, or every record matching its current search and filters.
 */
export const WIDGET_POPULATIONS = ["all", "filtered"] as const;

export type WidgetPopulation = (typeof WIDGET_POPULATIONS)[number];

/** Counts for one issue Summary Widget population (issue-widgets §3–§5). */
export interface IssueWidgetCounts {
  /** Every issue in the population, open or closed. */
  total: number;
  /** Open issues in the population. */
  open: number;
  /** Distinct machines with at least one open issue. */
  machinesWithOpenIssues: number;
  /** Issues of each status; closed statuses included. */
  byStatus: Record<IssueStatus, number>;
  /** Open issues of each severity. */
  bySeverity: Record<IssueSeverity, number>;
  /** Open issues of each priority. */
  byPriority: Record<IssuePriority, number>;
}

/** Counts for the issue-list Summary Widgets, each in its own population. */
export interface IssueListSummary {
  status: IssueWidgetCounts;
  severity: IssueWidgetCounts;
  priority: IssueWidgetCounts;
}
