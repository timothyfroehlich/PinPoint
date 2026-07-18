"use client";

import type React from "react";
import Link from "next/link";

import {
  MachineAttributionLine,
  type MachineLabel,
} from "./MachineAttributionLine";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { formatIssueId } from "~/lib/issues/utils";
import { STATUS_CONFIG } from "~/lib/issues/status";
import { MACHINE_EVENT_ICONS } from "~/lib/timeline/machine-event-icons";
import type { MachineIssueEventData } from "~/lib/timeline/machine-event-types";
import type { ResolvedMachineRef } from "~/lib/timeline/machine-events";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import {
  personSuffix,
  type ResolvedPerson,
} from "~/lib/timeline/resolve-person";
import { cn } from "~/lib/utils";

type IssueEventData = MachineIssueEventData;

export interface MachineIssueRowData {
  id: string;
  createdAt: Date;
  tag: TimelineTag;
  authorName: string | null;
  eventData: IssueEventData;
  /** Live-resolved person-references (`reporter`/`assignee`), keyed by role. */
  people: Record<string, ResolvedPerson>;
  /** Live-resolved referenced machines (reassign), keyed by machine id. */
  machineRefs: Record<string, ResolvedMachineRef>;
}

interface Props {
  row: MachineIssueRowData;
  machineInitials?: string;
  /** See `MachineTimelineSystemRow` for the rationale. */
  showRelativeTime?: boolean;
  /**
   * Absolute date ("May 14") for rows inside a Tier-2 (month) bucket. Shares
   * the right-pinned timestamp slot with the relative time — month rows show
   * the date there instead of "N ago". Omitted on Tier-1 (day) buckets where
   * the bucket banner already names the day.
   */
  rowDateLabel?: string;
  /**
   * Opt-in machine attribution line for combined (collection) feeds.
   * Per-machine timelines never set this — their rendering is unchanged.
   */
  machineLabel?: MachineLabel;
}

/**
 * Two-line timeline row for any `source_type='issue'` event.
 *
 * Line 1 layout: `[ID verb] [badges] [— Actor] [time]`. The em-dash and
 * actor name are visually part of the left cluster — time alone is
 * right-pinned via `margin-left: auto`. The row body is a container-query
 * context (`@container`); the actor clause and the secondary (frequency)
 * badge are shown/hidden purely in CSS against the body's own width, so
 * the layout adapts without any JS measurement:
 *
 *   - `@[560px]` and wider — actor clause shown (`full` tier).
 *   - `@[420px]`–`560px` — actor hidden, both badges shown (`no-actor`).
 *   - below `@[420px]` — actor hidden AND the Frequency badge dropped,
 *     keeping only Severity (`compact`). Mirrors the PP-dnk8 "mobile
 *     badge-wrap caps to Status+Severity" rule.
 *
 * Line 2: `<AFM-03 Title>` issue anchor. Wraps to multiple lines if the
 * title is long.
 *
 * Container queries replace the former ResizeObserver density hook: the
 * actor and frequency badge are always in the DOM (no hydration mismatch,
 * no "actor flashes in then disappears" flicker) and CSS alone toggles
 * their visibility at the two width thresholds.
 */
export function MachineTimelineIssueRow({
  row,
  machineInitials,
  showRelativeTime = true,
  rowDateLabel,
  machineLabel,
}: Props): React.JSX.Element {
  const { Icon, colorClass } = MACHINE_EVENT_ICONS[row.eventData.kind];
  const actor = resolveActor(row);
  const verbClause = formatVerbClause(row);
  const issueIdText = machineInitials
    ? formatIssueId(machineInitials, row.eventData.issueNumber)
    : `#${String(row.eventData.issueNumber)}`;
  const isLinkable =
    machineInitials != null && row.eventData.kind !== "issue_reassigned_out";
  const issueHref = isLinkable
    ? `/m/${machineInitials}/i/${String(row.eventData.issueNumber)}`
    : null;
  const title = "title" in row.eventData ? row.eventData.title : undefined;

  // Right-pinned timestamp slot: relative time for "today" rows, the absolute
  // date for month-rollup rows. One slot, one position — never both.
  // `<RelativeTime>` ticks every 60s so the label stays accurate while the
  // page is open; a raw formatRelative() would freeze at first render.
  const rightMeta: React.ReactNode = showRelativeTime ? (
    <RelativeTime value={row.createdAt} />
  ) : (
    rowDateLabel
  );

  return (
    <div
      className="flex gap-3 border-b py-3 text-sm"
      data-event-kind={row.eventData.kind}
    >
      <div className="flex size-10 shrink-0 items-center justify-center">
        <Icon aria-hidden="true" className={cn("size-5", colorClass)} />
      </div>
      {/* `@container`: the row body is the container-query context. The actor
          clause and frequency badge below query this element's own width via
          `@[560px]:` / `@[420px]:` utilities — the CSS successor to the old
          ResizeObserver density hook, matching its 560/420px thresholds. */}
      <div className="@container min-w-0 flex-1">
        {machineLabel ? (
          <MachineAttributionLine machine={machineLabel} />
        ) : null}
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden text-sm">
          {/* Line 1 reading order: ID (link) · verb · by Actor · badges
              · ‹spacer› · time. ID is the only link in this line — the
              title link lives on line 2.

              The ID is a *direct* shrink-0 flex child, not nested inside the
              shrinkable verb group: a min-w-0 wrapper can collapse below its
              own shrink-0 child, which paints the ID on top of the following
              badge on narrow rows. Keeping the ID at the top level reserves
              its width so it can never overlap the badges. */}
          {issueHref ? (
            <Link
              href={issueHref}
              className="shrink-0 font-mono font-semibold text-foreground hover:text-primary hover:underline"
            >
              {issueIdText}
            </Link>
          ) : (
            <span className="shrink-0 font-mono font-semibold text-foreground">
              {issueIdText}
            </span>
          )}
          <span className="flex min-w-0 items-baseline gap-1.5">
            {/* min-w-0 + flex-1: a flex child's default min-width:auto blocks
                shrinking, so `truncate` alone would overflow instead of
                clipping. Let the verb take the remaining space and ellipsize. */}
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {verbClause}
            </span>
            {actor ? (
              // Shown only once the row body reaches the `full` tier (≥560px);
              // hidden on narrower rows so the verb + badges + timestamp fit.
              <span className="hidden shrink-0 text-muted-foreground @[560px]:inline">
                by{" "}
                <span className="font-medium text-foreground/90">
                  {actor.name}
                </span>
                {actor.suffix}
              </span>
            ) : null}
          </span>
          <IssueRowBadges eventData={row.eventData} />
          {rightMeta ? (
            <span className="ml-auto shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {rightMeta}
            </span>
          ) : null}
        </div>
        {title ? (
          <div className="mt-1 text-sm">
            {issueHref ? (
              <Link
                href={issueHref}
                className="text-foreground hover:text-primary hover:underline"
              >
                {title}
              </Link>
            ) : (
              <span className="text-foreground">{title}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The actor shown in the "by X" clause, with a marker suffix distinguishing
 * an invited or guest reporter from a real user. Names resolve live (PP-tv9l).
 */
function resolveActor(
  row: MachineIssueRowData
): { name: string; suffix: string } | null {
  const ed = row.eventData;
  if (ed.kind === "issue_opened") {
    const reporter = row.people["reporter"];
    if (reporter) {
      return {
        name: reporter.displayName,
        suffix: personSuffix(reporter),
      };
    }
    // Freeform guest (no account id) — typed name, marked as not a user.
    if (ed.guestReporterName) {
      return { name: ed.guestReporterName, suffix: " (guest)" };
    }
    // A real actor (rare for opens) is shown by name; a fully anonymous public
    // report shows "Anonymous" — preserving the pre-PP-tv9l attribution rather
    // than dropping the "by" clause entirely.
    return row.authorName
      ? { name: row.authorName, suffix: "" }
      : { name: "Anonymous", suffix: "" };
  }
  // Every other issue event is performed by the acting (real) user.
  return row.authorName ? { name: row.authorName, suffix: "" } : null;
}

function formatVerbClause(row: MachineIssueRowData): string {
  const data = row.eventData;
  switch (data.kind) {
    case "issue_opened":
      return "opened";
    case "issue_closed":
      return "closed";
    case "issue_status_changed":
      return `→ ${formatStatusLabel(data.to)}`;
    case "issue_assigned": {
      const assignee = row.people["assignee"];
      return `assigned to ${assignee ? assignee.displayName : "someone"}`;
    }
    case "issue_unassigned":
      return "unassigned";
    case "issue_reassigned_out": {
      const m = row.machineRefs[data.toMachineId];
      return `moved to ${m ? m.name : "another machine"}`;
    }
    case "issue_reassigned_in": {
      const m = row.machineRefs[data.fromMachineId];
      return `received from ${m ? m.name : "another machine"}`;
    }
  }
}

function formatStatusLabel(value: string): string {
  if (value in STATUS_CONFIG) {
    return STATUS_CONFIG[value as keyof typeof STATUS_CONFIG].label;
  }
  return value;
}

interface IssueRowBadgesProps {
  eventData: IssueEventData;
}

function IssueRowBadges({
  eventData,
}: IssueRowBadgesProps): React.JSX.Element | null {
  if (eventData.kind === "issue_opened") {
    const badges: React.JSX.Element[] = [];
    if (eventData.severity) {
      badges.push(
        <IssueBadge
          key="severity"
          type="severity"
          value={eventData.severity}
          variant="strip"
        />
      );
    }
    // Frequency is the secondary badge — hidden below the `compact` threshold
    // (@[420px]) so Severity + ID + timestamp fit a ~360px row without
    // overlapping. Mirrors PP-dnk8's "mobile badge-wrap caps to
    // Status+Severity". Always in the DOM; CSS alone toggles it.
    if (eventData.frequency) {
      badges.push(
        <IssueBadge
          key="frequency"
          type="frequency"
          value={eventData.frequency}
          variant="strip"
          className="hidden @[420px]:flex"
        />
      );
    }
    if (badges.length === 0) return null;
    return <span className="inline-flex shrink-0 gap-1">{badges}</span>;
  }
  if (eventData.kind === "issue_closed" && eventData.closedAsStatus) {
    return (
      <IssueBadge
        type="status"
        value={eventData.closedAsStatus}
        variant="strip"
      />
    );
  }
  return null;
}
