"use client";

import * as React from "react";
import Link from "next/link";
import { Activity, MessageSquare } from "lucide-react";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import { formatCompactAgeAgo, formatSpokenAgeAgo } from "~/lib/dates";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  STATUS_GROUPS,
  type IssueStatus,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { fitLineParts } from "~/lib/list-view/overflow";
import type { IssueListRow } from "~/lib/types";
import { cn } from "~/lib/utils";

/** Line 2's parts that give way for room, in drop order (issues-list §3.9). */
const DROP_ORDER = ["age", "comments", "priority", "assignee"] as const;
type DroppablePart = (typeof DROP_ORDER)[number];
type StatusGroup = keyof typeof STATUS_GROUPS;

/** Line 2's parts in its right-anchored group, in display order. */
const TRAILING_PARTS = ["assignee", "comments", "age"] as const;

/** The gap between the left group's parts (`gap-1.5`). */
const LEFT_GAP = 6;
/** The gap between the right group's parts (`gap-2`). */
const RIGHT_GAP = 8;
/** The least room between the two groups (`pl-3`). */
const GROUP_GAP = 12;
/*
 * The left group (ID · machine, then the priority pill) lines its parts up
 * on one text baseline. Centering them instead puts the monospace issue ID
 * about a pixel above the rest: SF Mono's ascent and descent differ from the
 * sans font's, so the ID's line box is a fraction taller and centers off the
 * shared baseline. A "·" separates only two plain-text items, so the only
 * one is between the ID and the machine.
 */
const LEFT_GROUP_CLASSES = "flex min-w-0 items-baseline gap-1.5";
/*
 * The right group (assignee, comment count, age) holds no plain text to
 * share a baseline with, so its icons and avatar center on the line.
 */
const RIGHT_GROUP_CLASSES = "ml-auto flex shrink-0 items-center gap-2";

/*
 * Pills on List View rows have no border (issues-list §3.13), a scoped
 * exception to the design bible's chip; the configs' border colors only take
 * effect where a `border` class adds a width.
 */
const PILL_CLASSES =
  "inline-flex h-5 items-center rounded-full px-2 align-middle text-xs font-semibold whitespace-nowrap";

/*
 * Line 2's machine link on phones (list-views §7.9: every phone control is
 * at least 44px). Its invisible `::before` grows the hit area to 44px tall on
 * layer 1 of the row's stacking context, while the title and the machine
 * name draw on layer 2, so the hit area only claims taps on space no visible
 * link occupies. The row link's own overlay sits beneath both.
 */
const MACHINE_LINK_CLASSES =
  "relative flex min-w-0 max-md:min-w-11 before:absolute before:inset-x-0 before:-inset-y-3 before:z-[1] md:before:hidden";
const MACHINE_NAME_CLASSES = "truncate text-foreground/85 underline";
/** Lifts a link's visible text above the machine link's hit area. */
const VISIBLE_LAYER = "relative z-[2]";

/** Up to two initials from a display name: "Priya Shah" → "PS". */
function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function Separator({
  className,
}: {
  className?: string | undefined;
}): React.JSX.Element {
  return (
    <span aria-hidden="true" className={className}>
      ·
    </span>
  );
}

/** A status, severity, or priority value; read-only (issues-list §3.11). */
function RowPill({
  name,
  label,
  styles,
  className,
  testId,
}: {
  /** Announced before the label; null hides a pill another element announces. */
  name: "Severity" | "Priority" | null;
  label: string;
  styles: string;
  className?: string | undefined;
  testId?: string | undefined;
}): React.JSX.Element {
  return (
    <span
      className={cn(PILL_CLASSES, styles, className)}
      aria-hidden={name === null ? true : undefined}
      data-testid={testId}
    >
      {name === null ? null : <span className="sr-only">{name}: </span>}
      {label}
    </span>
  );
}

/*
 * Each status group's dot shape, so color is never the only cue (issues-list
 * §3.8), matching the machine rows' Playability dots: a ring for New, a
 * filled circle for In Progress, a diamond for Closed. Every shape sits in
 * the same 10px box and draws in the status color.
 */
const STATUS_DOT_SHAPES: Record<StatusGroup, string> = {
  new: "size-2.5 rounded-full border-2 border-current",
  in_progress: "size-2.5 rounded-full bg-current",
  closed: "size-1.75 rotate-45 rounded-[1px] bg-current",
};

function statusGroupOf(status: IssueStatus): StatusGroup {
  if (STATUS_GROUPS.new.some((s) => s === status)) return "new";
  if (STATUS_GROUPS.in_progress.some((s) => s === status)) return "in_progress";
  return "closed";
}

/**
 * The row's leading status dot (issues-list §3.2, §3.8), an image named
 * "Status: <status>". The status pill beside the title stays visible but
 * silent, so the status is announced once.
 */
function StatusDot({ status }: { status: IssueStatus }): React.JSX.Element {
  const config = STATUS_CONFIG[status];
  const name = `Status: ${config.label}`;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "mt-1.5 inline-flex size-2.5 shrink-0 items-center justify-center",
        config.iconColor
      )}
      data-testid="issue-status-dot"
    >
      <span
        aria-hidden="true"
        className={STATUS_DOT_SHAPES[statusGroupOf(status)]}
      />
    </span>
  );
}

/**
 * The assignee's initials in a circle; an empty dashed circle announced as
 * "Unassigned" when nobody is assigned (issues-list §3.7). Names only, never
 * email addresses.
 */
function AssigneeAvatar({
  name,
  testId,
}: {
  name: string | null;
  testId?: string | undefined;
}): React.JSX.Element {
  const who = name === null ? "Unassigned" : `Assigned to ${name}`;
  return (
    <span
      role="img"
      aria-label={who}
      title={who}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
        name === null
          ? "border border-dashed border-muted-foreground/60"
          : "bg-outline text-foreground"
      )}
      data-testid={testId}
    >
      {name === null ? null : nameInitials(name)}
    </span>
  );
}

/**
 * How many comments people wrote: a speech-bubble icon and the number,
 * announced as "3 comments" (issues-list §3.3, §3.4). The row leaves it out
 * at zero.
 */
function CommentCount({
  count,
  testId,
}: {
  count: number;
  testId?: string | undefined;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-[3px]" data-testid={testId}>
      <MessageSquare className="size-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        {count} {count === 1 ? "comment" : "comments"}
      </span>
    </span>
  );
}

/**
 * How long ago the issue was updated: an activity icon and "2d ago" at every
 * width (issues-list §3.3), announced as "Updated 2 days ago".
 */
function UpdatedAge({
  updatedAt,
  testId,
}: {
  updatedAt: Date;
  testId?: string | undefined;
}): React.JSX.Element {
  // Null during SSR and before the shared ticker's first tick.
  const now = useRelativeNow();
  const date = new Date(updatedAt);
  const shown = now === null ? "" : formatCompactAgeAgo(date, now);
  const spoken = now === null ? "" : formatSpokenAgeAgo(date, now);
  return (
    <time
      dateTime={date.toISOString()}
      className="inline-flex items-center gap-1"
      data-testid={testId}
    >
      <Activity className="size-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">Updated {spoken}</span>
    </time>
  );
}

/**
 * Line 2 (issues-list §3.3, §3.9), on one line at every width, in two
 * groups. The left group is the issue ID · the machine, then the priority
 * pill. The right group sits at the line's end: the assignee's initials, the
 * comment count (when above zero), and the age, at least 12px from the left
 * group. When the line does not fit it drops the age, then the comment
 * count, then the priority, then the assignee; the ID never drops, the right
 * group stays at the line's end as its parts drop, and the machine name
 * truncates only after all four are gone. The component measures each part
 * in a hidden lane and plans which stay with the pure `fitLineParts`. A
 * dropped part stays readable to screen readers.
 */
function IssueRowDetails({
  issue,
}: {
  issue: IssueListRow;
}): React.JSX.Element {
  const hasComments = issue.commentCount > 0;
  const lineRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  // The age's text is empty until the shared ticker's first tick, then
  // changes as time passes; keying the measurement on it re-measures the
  // lane when it does, without waiting on a ResizeObserver callback (which a
  // background tab may never deliver).
  const now = useRelativeNow();
  const ageText =
    now === null ? "" : formatCompactAgeAgo(new Date(issue.updatedAt), now);
  const measured = useMeasuredWidths(
    lineRef,
    laneRef,
    `${issue.id}:${hasComments}:${ageText}`
  );
  const priority = PRIORITY_CONFIG[issue.priority];
  const assigneeName = issue.assignedToUser?.name ?? null;
  const issueId = formatIssueId(issue.machineInitials, issue.issueNumber);
  // A row without comments has no comment part to drop.
  const withoutAbsentComments = <Part extends DroppablePart>(
    parts: readonly Part[]
  ): Part[] => parts.filter((part) => hasComments || part !== "comments");
  const dropOrder = withoutAbsentComments(DROP_ORDER);

  const shown: ReadonlySet<DroppablePart> =
    measured && measured.available > 0
      ? fitLineParts({
          available: measured.available,
          keptWidths: [
            measured.widths["id"] ?? 0,
            measured.widths["machine"] ?? 0,
          ],
          partWidths: {
            priority: measured.widths["priority"] ?? 0,
            assignee: measured.widths["assignee"] ?? 0,
            comments: measured.widths["comments"] ?? 0,
            age: measured.widths["age"] ?? 0,
          },
          dropOrder,
          gap: LEFT_GAP,
          trailing: {
            parts: withoutAbsentComments(TRAILING_PARTS),
            gap: RIGHT_GAP,
            groupGap: GROUP_GAP,
          },
        })
      : new Set(dropOrder);
  const partClass = (part: DroppablePart): string =>
    shown.has(part) ? "flex shrink-0" : "sr-only";
  // The right group keeps its 12px lead only while it shows something.
  const rightGroupShows = TRAILING_PARTS.some((part) => shown.has(part));

  const idText = (
    <span className="font-mono text-foreground/85">{issueId}</span>
  );

  return (
    <>
      {/* `overflow-x-clip` keeps an unplanned overflow (before the first
          measurement) inside the row without clipping the machine link's
          taller hit area. */}
      <div
        ref={lineRef}
        className="mt-0.5 flex min-w-0 items-center overflow-x-clip text-[13px] leading-[1.4] whitespace-nowrap text-muted-foreground"
      >
        <span className={LEFT_GROUP_CLASSES}>
          <span className="shrink-0" data-testid="issue-id">
            {idText}
          </span>
          <Separator className="shrink-0" />
          <Link
            href={`/m/${issue.machineInitials}`}
            className={cn(
              MACHINE_LINK_CLASSES,
              "transition-colors duration-150 hover:text-foreground"
            )}
            data-testid="issue-machine"
          >
            <span className={cn(MACHINE_NAME_CLASSES, VISIBLE_LAYER)}>
              {issue.machine.name}
            </span>
          </Link>
          <span className={partClass("priority")}>
            <RowPill
              name="Priority"
              label={priority.label}
              styles={priority.styles}
              testId="issue-priority"
            />
          </span>
        </span>
        <span className={cn(RIGHT_GROUP_CLASSES, rightGroupShows && "pl-3")}>
          <span className={partClass("assignee")}>
            <AssigneeAvatar name={assigneeName} testId="issue-assignee" />
          </span>
          {hasComments && (
            <span className={partClass("comments")}>
              <CommentCount
                count={issue.commentCount}
                testId="issue-comment-count"
              />
            </span>
          )}
          <span className={partClass("age")}>
            <UpdatedAge updatedAt={issue.updatedAt} testId="issue-age" />
          </span>
        </span>
      </div>

      {/* Each part at its full width, out of the accessibility tree and the
          tab order, clipped so it never widens the page. The machine part
          carries the "·" before it; the groups' gaps come from the planner. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden text-[13px] whitespace-nowrap"
      >
        <span data-measure="id" className="absolute w-max">
          {idText}
        </span>
        <span
          data-measure="machine"
          className="absolute flex w-max items-baseline gap-1.5"
        >
          <Separator />
          <span className={MACHINE_LINK_CLASSES}>
            <span className={MACHINE_NAME_CLASSES}>{issue.machine.name}</span>
          </span>
        </span>
        <span data-measure="priority" className="absolute flex w-max">
          <RowPill
            name="Priority"
            label={priority.label}
            styles={priority.styles}
          />
        </span>
        <span data-measure="assignee" className="absolute flex w-max">
          <AssigneeAvatar name={assigneeName} />
        </span>
        {hasComments && (
          <span data-measure="comments" className="absolute flex w-max">
            <CommentCount count={issue.commentCount} />
          </span>
        )}
        <span data-measure="age" className="absolute flex w-max">
          <UpdatedAge updatedAt={issue.updatedAt} />
        </span>
      </div>
    </>
  );
}

/**
 * One issue row (issues-list §3), the same two lines at every width. Line 1:
 * the status dot, then the full title, wrapping, with the status and
 * severity pills flowing after it as a pair (both move to the next line when
 * they do not both fit). Line 2 lines up under the title, beside the dot's
 * column: see `IssueRowDetails`. The row is read-only (§3.11). The whole row
 * links to the issue through the title link's `::after` overlay; the machine
 * name is its own link, raised above the overlay (§3.12).
 */
export function IssueListEntry({
  issue,
}: {
  issue: IssueListRow;
}): React.JSX.Element {
  const status = STATUS_CONFIG[issue.status];
  const severity = SEVERITY_CONFIG[issue.severity];

  return (
    <li
      data-testid="issue-row"
      data-issue-id={issue.id}
      className="group/row relative isolate px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 max-md:border-b max-md:border-border sm:max-md:px-8"
    >
      {/* The dot keeps its own column; the title and line 2 share the
          content column beside it. */}
      <div className="flex items-start gap-2.5">
        <StatusDot status={issue.status} />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] leading-[1.45]">
            <Link
              href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
              className="mr-1.5 font-semibold break-words text-foreground transition-colors duration-150 group-hover/row:text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
              data-testid="issue-title"
            >
              <span className={VISIBLE_LAYER}>{issue.title}</span>
            </Link>
            {/* One unbreakable box, so the pills wrap below the title
                together or not at all. Its baseline is the pills' text, 2px
                above the title's. The status pill is silent: the dot
                announces the status. */}
            <span className="inline-flex gap-1 align-[2px]">
              <RowPill
                name={null}
                label={status.label}
                styles={status.styles}
                testId="issue-status"
              />
              <RowPill
                name="Severity"
                label={severity.label}
                styles={severity.styles}
                testId="issue-severity"
              />
            </span>
          </div>
          <IssueRowDetails issue={issue} />
        </div>
      </div>
    </li>
  );
}
