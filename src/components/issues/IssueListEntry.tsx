"use client";

import * as React from "react";
import Link from "next/link";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import { formatCompactAge, formatCompactAgeAgo } from "~/lib/dates";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { fitLineParts } from "~/lib/list-view/overflow";
import type { IssueListRow } from "~/lib/types";
import { cn } from "~/lib/utils";

/** Line 2's parts that give way for room, in drop order (issues-list §3.9). */
const DROP_ORDER = ["age", "priority", "assignee"] as const;
type DroppablePart = (typeof DROP_ORDER)[number];

/** Line 2's column gap (`gap-1.5`); every part after the first leads with "·". */
const LINE_GAP = 6;
const LINE_CLASSES = "flex items-center gap-1.5";

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
const MACHINE_NAME_CLASSES =
  "truncate text-foreground/85 underline decoration-primary/30 underline-offset-2";
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
  name: "Status" | "Severity" | "Priority";
  label: string;
  styles: string;
  className?: string | undefined;
  testId?: string | undefined;
}): React.JSX.Element {
  return (
    <span className={cn(PILL_CLASSES, styles, className)} data-testid={testId}>
      <span className="sr-only">{name}: </span>
      {label}
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
          : "bg-muted text-foreground"
      )}
      data-testid={testId}
    >
      {name === null ? null : nameInitials(name)}
    </span>
  );
}

/**
 * How long ago the issue was updated: "2d" on phones, "updated 2d ago" on
 * desktop (issues-list §3.3). Phones announce the long form too.
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
  const short = now === null ? "" : formatCompactAge(date, now);
  const long = now === null ? "" : formatCompactAgeAgo(date, now);
  return (
    <time dateTime={date.toISOString()} data-testid={testId}>
      <span aria-hidden="true" className="md:hidden">
        {short}
      </span>
      <span className="max-md:sr-only">updated {long}</span>
    </time>
  );
}

/**
 * Line 2 (issues-list §3.3, §3.9): the issue ID (desktop only), the machine,
 * the priority pill, the assignee's initials, and the age, on one line. When
 * the line does not fit it drops the age, then the priority, then the
 * assignee; the machine name truncates only after all three are gone. The
 * component measures each part in a hidden lane and plans which stay with
 * the pure `fitLineParts`. A dropped part stays readable to screen readers.
 */
function IssueRowDetails({
  issue,
}: {
  issue: IssueListRow;
}): React.JSX.Element {
  const lineRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const measured = useMeasuredWidths(lineRef, laneRef, issue.id);
  const priority = PRIORITY_CONFIG[issue.priority];
  const assigneeName = issue.assignedToUser?.name ?? null;
  const issueId = formatIssueId(issue.machineInitials, issue.issueNumber);

  const shown: ReadonlySet<DroppablePart> =
    measured && measured.available > 0
      ? fitLineParts({
          available: measured.available,
          // The ID is not laid out on phones, so it measures zero there.
          keptWidths: [
            measured.widths["id"] ?? 0,
            measured.widths["machine"] ?? 0,
          ],
          partWidths: {
            priority: measured.widths["priority"] ?? 0,
            assignee: measured.widths["assignee"] ?? 0,
            age: measured.widths["age"] ?? 0,
          },
          dropOrder: DROP_ORDER,
          gap: LINE_GAP,
        })
      : new Set(DROP_ORDER);
  const partClass = (part: DroppablePart): string =>
    shown.has(part) ? cn(LINE_CLASSES, "shrink-0") : "sr-only";

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
        className={cn(
          LINE_CLASSES,
          "mt-0.5 min-w-0 overflow-x-clip text-[13px] whitespace-nowrap text-muted-foreground"
        )}
      >
        <span className="hidden shrink-0 md:inline" data-testid="issue-id">
          {idText}
        </span>
        <span className={cn(LINE_CLASSES, "min-w-0")}>
          <Separator className="hidden md:inline" />
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
        </span>
        <span className={partClass("priority")}>
          <Separator />
          <RowPill
            name="Priority"
            label={priority.label}
            styles={priority.styles}
            testId="issue-priority"
          />
        </span>
        <span className={partClass("assignee")}>
          <Separator />
          <AssigneeAvatar name={assigneeName} testId="issue-assignee" />
        </span>
        <span className={partClass("age")}>
          <Separator />
          <UpdatedAge updatedAt={issue.updatedAt} testId="issue-age" />
        </span>
      </div>

      {/* Each part at its full width, out of the accessibility tree and the
          tab order, clipped so it never widens the page. */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden text-[13px] whitespace-nowrap"
      >
        <span data-measure="id" className="absolute hidden w-max md:inline">
          {idText}
        </span>
        <span
          data-measure="machine"
          className={cn(LINE_CLASSES, "absolute w-max")}
        >
          <Separator className="hidden md:inline" />
          <span className={MACHINE_LINK_CLASSES}>
            <span className={MACHINE_NAME_CLASSES}>{issue.machine.name}</span>
          </span>
        </span>
        <span
          data-measure="priority"
          className={cn(LINE_CLASSES, "absolute w-max")}
        >
          <Separator />
          <RowPill
            name="Priority"
            label={priority.label}
            styles={priority.styles}
          />
        </span>
        <span
          data-measure="assignee"
          className={cn(LINE_CLASSES, "absolute w-max")}
        >
          <Separator />
          <AssigneeAvatar name={assigneeName} />
        </span>
        <span data-measure="age" className={cn(LINE_CLASSES, "absolute w-max")}>
          <Separator />
          <UpdatedAge updatedAt={issue.updatedAt} />
        </span>
      </div>
    </>
  );
}

/**
 * One issue row (issues-list §3), the same two lines at every width. Line 1:
 * the full title, wrapping, then the status and severity pills flowing after
 * it. Line 2: see `IssueRowDetails`. The row is read-only (§3.11). The whole
 * row links to the issue through the title link's `::after` overlay; the
 * machine name is its own link, raised above the overlay (§3.12).
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
      className="group/row relative isolate px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 sm:max-md:px-8"
    >
      <div className="leading-snug">
        <Link
          href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
          className="mr-1.5 align-middle text-[15px] font-semibold break-words text-foreground transition-colors duration-150 group-hover/row:text-primary after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
          data-testid="issue-title"
        >
          <span className={VISIBLE_LAYER}>{issue.title}</span>
        </Link>
        <RowPill
          name="Status"
          label={status.label}
          styles={status.styles}
          className="mr-1"
          testId="issue-status"
        />
        <RowPill
          name="Severity"
          label={severity.label}
          styles={severity.styles}
          testId="issue-severity"
        />
      </div>
      <IssueRowDetails issue={issue} />
    </li>
  );
}
