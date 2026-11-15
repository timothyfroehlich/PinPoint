"use client";

import type React from "react";
import Link from "next/link";
import { Activity, MessageSquare } from "lucide-react";
import {
  LIST_ROW_RAISED,
  ListRow,
  ListRowDetails,
  ListRowTitleLink,
  type ListRowPart,
} from "~/components/list-view/ListRow";
import {
  InitialsAvatar,
  ListRowDot,
  RowAge,
  useRowAgeText,
  type ListRowDotShape,
} from "~/components/list-view/row-parts";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  STATUS_GROUPS,
  type IssueStatus,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import type { IssueListRow } from "~/lib/types";
import { cn } from "~/lib/utils";

type DetailPart =
  "id" | "machine" | "priority" | "assignee" | "comments" | "age";

/** Line 2's parts that give way for room, in drop order (issues-list §3.9). */
const DROP_ORDER: readonly DetailPart[] = [
  "age",
  "comments",
  "priority",
  "assignee",
];

type StatusGroup = keyof typeof STATUS_GROUPS;

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
 * Each status group's dot shape (issues-list §3.8), matching the machine
 * rows' Playability dots: a ring for New, a filled circle for In Progress, a
 * diamond for Closed.
 */
const STATUS_DOT_SHAPES: Record<StatusGroup, ListRowDotShape> = {
  new: "ring",
  in_progress: "filled",
  closed: "diamond",
};

function statusGroupOf(status: IssueStatus): StatusGroup {
  if (STATUS_GROUPS.new.some((s) => s === status)) return "new";
  if (STATUS_GROUPS.in_progress.some((s) => s === status)) return "in_progress";
  return "closed";
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

function updatedSpoken(age: string): string {
  return `Updated ${age}`;
}

/**
 * Line 2 (issues-list §3.3, §3.9). The leading group is the issue ID · the
 * machine, then the priority pill; the trailing group is the assignee's
 * initials, the comment count (when above zero), and the age. When the line
 * does not fit it drops the age, then the comment count, then the priority,
 * then the assignee; the ID never drops, and the machine name truncates only
 * after all four are gone.
 */
function IssueRowDetails({
  issue,
}: {
  issue: IssueListRow;
}): React.JSX.Element {
  const hasComments = issue.commentCount > 0;
  const ageText = useRowAgeText(issue.updatedAt);
  const priority = PRIORITY_CONFIG[issue.priority];
  const assigneeName = issue.assignedToUser?.name ?? null;
  const assigneeLabel =
    assigneeName === null ? "Unassigned" : `Assigned to ${assigneeName}`;
  const issueId = formatIssueId(issue.machineInitials, issue.issueNumber);
  const priorityPill = (testId?: string): React.JSX.Element => (
    <RowPill
      name="Priority"
      label={priority.label}
      styles={priority.styles}
      testId={testId}
    />
  );

  const leading: ListRowPart<DetailPart>[] = [
    {
      key: "id",
      text: true,
      node: (
        <span className="font-mono text-foreground/85" data-testid="issue-id">
          {issueId}
        </span>
      ),
      measure: <span className="font-mono">{issueId}</span>,
    },
    {
      key: "machine",
      text: true,
      truncate: true,
      node: (
        <Link
          href={`/m/${issue.machineInitials}`}
          className={cn(
            MACHINE_LINK_CLASSES,
            "transition-colors duration-150 hover:text-foreground motion-reduce:transition-none"
          )}
          data-testid="issue-machine"
        >
          <span className={cn(MACHINE_NAME_CLASSES, LIST_ROW_RAISED)}>
            {issue.machine.name}
          </span>
        </Link>
      ),
      measure: (
        <span className={MACHINE_LINK_CLASSES}>
          <span className={MACHINE_NAME_CLASSES}>{issue.machine.name}</span>
        </span>
      ),
    },
    {
      key: "priority",
      node: priorityPill("issue-priority"),
      measure: priorityPill(),
    },
  ];
  const trailing: ListRowPart<DetailPart>[] = [
    {
      key: "assignee",
      node: (
        <InitialsAvatar
          name={assigneeName}
          label={assigneeLabel}
          testId="issue-assignee"
        />
      ),
      measure: <InitialsAvatar name={assigneeName} label={assigneeLabel} />,
    },
    ...(hasComments
      ? [
          {
            key: "comments" as const,
            node: (
              <CommentCount
                count={issue.commentCount}
                testId="issue-comment-count"
              />
            ),
            measure: <CommentCount count={issue.commentCount} />,
          },
        ]
      : []),
    {
      key: "age",
      node: (
        <RowAge
          date={issue.updatedAt}
          icon={Activity}
          spoken={updatedSpoken}
          testId="issue-age"
        />
      ),
      measure: (
        <RowAge date={issue.updatedAt} icon={Activity} spoken={updatedSpoken} />
      ),
    },
  ];

  return (
    <ListRowDetails
      leading={leading}
      trailing={trailing}
      dropOrder={DROP_ORDER}
      contentKey={`${issue.id}:${hasComments}:${ageText}`}
    />
  );
}

/**
 * One issue row (issues-list §3), on the shared two-line row. Line 1: the
 * status dot, then the full title, wrapping, with the status and severity
 * pills flowing after it as a pair (both move to the next line when they do
 * not both fit). Line 2: see `IssueRowDetails`. The row is read-only
 * (§3.11). The whole row links to the issue; the machine name is its own
 * link, raised above the row link (§3.12).
 */
export function IssueListEntry({
  issue,
}: {
  issue: IssueListRow;
}): React.JSX.Element {
  const status = STATUS_CONFIG[issue.status];
  const severity = SEVERITY_CONFIG[issue.severity];
  const statusName = `Status: ${status.label}`;

  return (
    <ListRow
      testId="issue-row"
      data={{ "data-issue-id": issue.id }}
      // The dot announces the status; the status pill shows it silently.
      dot={
        <ListRowDot
          shape={STATUS_DOT_SHAPES[statusGroupOf(issue.status)]}
          colorClass={status.iconColor}
          label={statusName}
          testId="issue-status-dot"
        />
      }
      title={
        <>
          <ListRowTitleLink
            href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
            className="mr-1.5"
            testId="issue-title"
          >
            {issue.title}
          </ListRowTitleLink>
          {/* One unbreakable box, so the pills wrap below the title
              together or not at all. Its baseline is the pills' text, 2px
              above the title's. */}
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
        </>
      }
      details={<IssueRowDetails issue={issue} />}
    />
  );
}
