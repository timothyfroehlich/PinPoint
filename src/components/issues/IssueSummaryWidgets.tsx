"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SummaryWidget,
  SummaryWidgetGroup,
  type SummaryWidgetSegment,
} from "~/components/summary-widgets";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { parseIssueFilters } from "~/lib/issues/filters";
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
} from "~/lib/types";

const STORAGE_KEY = "pinpoint:summary-widgets:issues";

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

/**
 * The retired Widget Population parameters (issue-widgets §2.3). They are
 * ignored, and dropped from the address bar when a URL still carries them.
 */
const RETIRED_PARAMS = ["status_widget", "severity_widget", "priority_widget"];

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
 * spec). Every widget counts the host's whole scope (§2.2), whatever the
 * list's filters. Reads the list's filters from the URL, as IssueList does,
 * so a group Issues tab's forced machine scope never leaks into the URL.
 */
export function IssueSummaryWidgets({
  summary,
}: IssueSummaryWidgetsProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseIssueFilters(searchParams);
  const { pushFilters } = useSearchFilters(filters);

  React.useEffect(() => {
    if (!RETIRED_PARAMS.some((param) => searchParams.has(param))) return;
    const canonical = new URLSearchParams(searchParams.toString());
    for (const param of RETIRED_PARAMS) canonical.delete(param);
    const query = canonical.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

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

  // The open-issue total and the Unplayable open-issue count (§2.4).
  const summaryRow = (
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

  return (
    <SummaryWidgetGroup
      storageKey={STORAGE_KEY}
      summaryRow={summaryRow}
      widgetCount={3}
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
        selectedValue={soleValue(filters.status)}
        onSegmentSelect={(value) => pushFilters({ status: [value], page: 1 })}
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
        selectedValue={soleValue(filters.severity)}
        onSegmentSelect={(value) => pushFilters({ severity: [value], page: 1 })}
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
        selectedValue={soleValue(filters.priority)}
        onSegmentSelect={(value) => pushFilters({ priority: [value], page: 1 })}
      />
    </SummaryWidgetGroup>
  );
}
