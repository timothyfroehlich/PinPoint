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
  OPEN_STATUS_GROUPS,
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  STATUS_GROUPS,
  type OpenStatusGroup,
} from "~/lib/issues/status";
import { arraysEqual } from "~/lib/list-view/url-state";
import { STATUS_FILTER_GROUP_NAMES } from "./issue-filters";
import type {
  IssueListSummary,
  IssuePriority,
  IssueSeverity,
  IssueViewState,
} from "~/lib/types";

/** Browser storage key for the Issues widgets' expanded choice (widgets §2.6). */
export const ISSUE_SUMMARY_STORAGE_KEY = "pinpoint:summary-widgets:issues";

/**
 * Segment order: Status runs New then In Progress (issue-widgets §3.2);
 * Severity and Priority run worst first (§4.2, §5.2).
 */
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

/** The value a filter holds when it holds exactly one value, else null. */
function soleValue<T>(values: readonly T[]): T | null {
  return values.length === 1 ? (values[0] ?? null) : null;
}

/** The open status group the Status filter holds exactly, else null. */
function selectedStatusGroup(
  status: IssueViewState["status"]
): OpenStatusGroup | null {
  return (
    OPEN_STATUS_GROUPS.find((group) =>
      arraysEqual(status, STATUS_GROUPS[group])
    ) ?? null
  );
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
 * list's filters; a Segment sets its own filter and returns to page 1
 * (widgets §6.1, §6.2). A Status Segment is a status group, so it sets the
 * Status filter to every status in the group, in canonical order (§3.3).
 */
export function IssueSummaryWidgets({
  summary,
  state,
  onStateChange,
  controller,
}: IssueSummaryWidgetsProps): React.JSX.Element {
  // No status group has a colour of its own; each takes its namesake status's.
  const statusSegments: SummaryWidgetSegment<OpenStatusGroup>[] =
    OPEN_STATUS_GROUPS.map((value) => ({
      value,
      label: STATUS_FILTER_GROUP_NAMES[value],
      count: summary.byStatusGroup[value],
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
        segments={statusSegments}
        selectedValue={selectedStatusGroup(state.status)}
        onSegmentSelect={(group) =>
          onStateChange({
            ...state,
            status: [...STATUS_GROUPS[group]],
            page: 1,
          })
        }
      />
      <SummaryWidget
        id="issue-widget-severity"
        label="Severity"
        segments={severitySegments}
        selectedValue={soleValue(state.severity)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, severity: [value], page: 1 })
        }
      />
      <SummaryWidget
        id="issue-widget-priority"
        label="Priority"
        segments={prioritySegments}
        selectedValue={soleValue(state.priority)}
        onSegmentSelect={(value) =>
          onStateChange({ ...state, priority: [value], page: 1 })
        }
      />
    </SummaryWidgetGroup>
  );
}
