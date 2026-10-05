"use client";

import type React from "react";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
  type SummaryWidgetsController,
} from "~/components/summary-widgets";
import { cn } from "~/lib/utils";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  type IssueStatus,
} from "~/lib/issues/status";
import type {
  IssueListSummary,
  IssuePriority,
  IssueSeverity,
  IssueViewState,
} from "~/lib/types";

/** Browser storage key for the Issues widgets' expanded choice (widgets §2.6). */
export const ISSUE_SUMMARY_STORAGE_KEY = "pinpoint:summary-widgets:issues";

/** Segment order, worst first (issue-widgets §3.2, §4.2, §5.2). */
const STATUS_SEGMENTS: readonly IssueStatus[] = [
  "need_help",
  "need_parts",
  "wait_owner",
  "new",
  "confirmed",
  "in_progress",
];
const SEVERITY_SEGMENTS: readonly IssueSeverity[] = [
  "unplayable",
  "major",
  "minor",
  "cosmetic",
];
const PRIORITY_SEGMENTS: readonly IssuePriority[] = ["high", "medium", "low"];

interface IssueSummaryWidgetsProps {
  summary: IssueListSummary;
  state: IssueViewState;
  /** Shows a new configuration; a Segment keeps every other filter (widgets §6.2). */
  onStateChange: (next: IssueViewState) => void;
  /** Shares the expanded state with a Summary Row toggle in the title row. */
  controller?: SummaryWidgetsController | undefined;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** The value a filter holds when it holds exactly one value, else null. */
function soleValue<T>(values: readonly T[]): T | null {
  return values.length === 1 ? (values[0] ?? null) : null;
}

function machinesText(count: number): string {
  return `open across ${count} ${plural(count, "machine", "machines")}`;
}

/** The Summary Row: the open total and the Unplayable count (issue-widgets §2.4). */
export function IssueSummaryRow({
  summary,
}: {
  summary: IssueListSummary;
}): React.JSX.Element {
  return (
    <>
      <span className="font-semibold text-foreground tabular-nums">
        {summary.open}
      </span>{" "}
      open ·{" "}
      <span
        className={cn(
          "font-semibold tabular-nums",
          SEVERITY_CONFIG.unplayable.iconColor
        )}
      >
        {summary.bySeverity.unplayable}
      </span>{" "}
      unplayable
    </>
  );
}

/**
 * The Status, Severity, and Priority widgets on Issue View (issue-widgets
 * spec). Every widget counts the host's whole scope (§2.2), whatever the
 * list's filters; a Segment sets its own filter to that value alone and
 * returns to page 1 (widgets §6.1, §6.2).
 */
export function IssueSummaryWidgets({
  summary,
  state,
  onStateChange,
  controller,
}: IssueSummaryWidgetsProps): React.JSX.Element {
  const statusSegments: SummaryWidgetSegment<IssueStatus>[] =
    STATUS_SEGMENTS.map((value) => ({
      value,
      label: STATUS_CONFIG[value].label,
      count: summary.byStatus[value],
      textClassName: STATUS_CONFIG[value].iconColor,
      fillClassName: STATUS_CONFIG[value].barColor,
    }));
  const severitySegments: SummaryWidgetSegment<IssueSeverity>[] =
    SEVERITY_SEGMENTS.map((value) => ({
      value,
      label: SEVERITY_CONFIG[value].label,
      count: summary.bySeverity[value],
      textClassName: SEVERITY_CONFIG[value].iconColor,
      fillClassName: SEVERITY_CONFIG[value].barColor,
    }));
  const prioritySegments: SummaryWidgetSegment<IssuePriority>[] =
    PRIORITY_SEGMENTS.map((value) => ({
      value,
      label: PRIORITY_CONFIG[value].label,
      count: summary.byPriority[value],
      textClassName: PRIORITY_CONFIG[value].iconColor,
      fillClassName: PRIORITY_CONFIG[value].barColor,
    }));

  return (
    <SummaryWidgetGroup
      storageKey={ISSUE_SUMMARY_STORAGE_KEY}
      summaryRow={<IssueSummaryRow summary={summary} />}
      widgetCount={3}
      controller={controller}
    >
      <SummaryWidget
        id="issue-widget-status"
        label="Status"
        headline={{
          figure: summary.open,
          text: `open of ${summary.total} ${plural(summary.total, "issue", "issues")}`,
          accentClassName: STATUS_CONFIG.new.iconColor,
        }}
        segments={statusSegments}
        selectedValue={soleValue(state.status)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, status: [value], page: 1 })
        }
      />
      <SummaryWidget
        id="issue-widget-severity"
        label="Severity"
        headline={{
          figure: summary.open,
          text: machinesText(summary.machinesWithOpenIssues),
          accentClassName: "text-warning",
        }}
        segments={severitySegments}
        selectedValue={soleValue(state.severity)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, severity: [value], page: 1 })
        }
      />
      <SummaryWidget
        id="issue-widget-priority"
        label="Priority"
        headline={{
          figure: summary.open,
          text: machinesText(summary.machinesWithOpenIssues),
          accentClassName: PRIORITY_CONFIG.high.iconColor,
        }}
        segments={prioritySegments}
        selectedValue={soleValue(state.priority)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, priority: [value], page: 1 })
        }
      />
    </SummaryWidgetGroup>
  );
}
