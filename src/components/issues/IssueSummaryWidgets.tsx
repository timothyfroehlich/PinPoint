"use client";

import type React from "react";
import { useSearchParams } from "next/navigation";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
} from "~/components/summary-widgets";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { parseIssueFilters } from "~/lib/issues/filters";
import {
  OPEN_STATUSES,
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  type IssueStatus,
} from "~/lib/issues/status";
import {
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  type IssueListSummary,
  type IssuePriority,
  type IssueSeverity,
} from "~/lib/types";

const STORAGE_KEY = "pinpoint:summary-widgets:issues";

interface IssueSummaryWidgetsProps {
  summary: IssueListSummary;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** The value a filter holds when it holds exactly one value, else null. */
function soleValue<T>(values: T[] | undefined): T | null {
  return values?.length === 1 ? (values[0] ?? null) : null;
}

function machinesText(count: number): string {
  return `open across ${count} ${plural(count, "machine", "machines")}`;
}

/**
 * The Status, Severity, and Priority widgets on issue lists (issue-widgets
 * spec). Reads the list's filters from the URL, as IssueList does, so a group
 * Issues tab's forced machine scope never leaks into the URL.
 */
export function IssueSummaryWidgets({
  summary,
}: IssueSummaryWidgetsProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const filters = parseIssueFilters(searchParams);
  const { pushFilters } = useSearchFilters(filters);
  const { status, severity, priority } = summary;

  const statusSegments: SummaryWidgetSegment<IssueStatus>[] = OPEN_STATUSES.map(
    (value) => ({
      value,
      label: STATUS_CONFIG[value].label,
      count: status.byStatus[value],
      textClassName: STATUS_CONFIG[value].iconColor,
      fillClassName: STATUS_CONFIG[value].barColor,
    })
  );
  const severitySegments: SummaryWidgetSegment<IssueSeverity>[] =
    ISSUE_SEVERITY_VALUES.map((value) => ({
      value,
      label: SEVERITY_CONFIG[value].label,
      count: severity.bySeverity[value],
      textClassName: SEVERITY_CONFIG[value].iconColor,
      fillClassName: SEVERITY_CONFIG[value].barColor,
    }));
  const prioritySegments: SummaryWidgetSegment<IssuePriority>[] =
    ISSUE_PRIORITY_VALUES.map((value) => ({
      value,
      label: PRIORITY_CONFIG[value].label,
      count: priority.byPriority[value],
      textClassName: PRIORITY_CONFIG[value].iconColor,
      fillClassName: PRIORITY_CONFIG[value].barColor,
    }));

  const summaryRow = [
    `${status.open} open`,
    `${severity.bySeverity.unplayable} unplayable`,
    `${priority.byPriority.high} high priority`,
  ].join(" · ");

  return (
    <SummaryWidgetGroup storageKey={STORAGE_KEY} summaryRow={summaryRow}>
      <SummaryWidget
        id="issue-widget-status"
        label="Status"
        population={filters.statusWidget ?? "all"}
        onPopulationChange={(statusWidget) => pushFilters({ statusWidget })}
        headline={{
          figure: status.open,
          text: `open of ${status.total} ${plural(status.total, "issue", "issues")}`,
          accentClassName: STATUS_CONFIG.new.iconColor,
        }}
        segments={statusSegments}
        selectedValue={soleValue(filters.status)}
        onSegmentSelect={(value) => pushFilters({ status: [value], page: 1 })}
      />
      <SummaryWidget
        id="issue-widget-severity"
        label="Severity"
        population={filters.severityWidget ?? "all"}
        onPopulationChange={(severityWidget) => pushFilters({ severityWidget })}
        headline={{
          figure: severity.open,
          text: machinesText(severity.machinesWithOpenIssues),
          accentClassName: "text-warning",
        }}
        segments={severitySegments}
        selectedValue={soleValue(filters.severity)}
        onSegmentSelect={(value) => pushFilters({ severity: [value], page: 1 })}
      />
      <SummaryWidget
        id="issue-widget-priority"
        label="Priority"
        population={filters.priorityWidget ?? "all"}
        onPopulationChange={(priorityWidget) => pushFilters({ priorityWidget })}
        headline={{
          figure: priority.open,
          text: machinesText(priority.machinesWithOpenIssues),
          accentClassName: PRIORITY_CONFIG.high.iconColor,
        }}
        segments={prioritySegments}
        selectedValue={soleValue(filters.priority)}
        onSegmentSelect={(value) => pushFilters({ priority: [value], page: 1 })}
      />
    </SummaryWidgetGroup>
  );
}
