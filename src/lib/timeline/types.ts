/**
 * Timeline Event Types & Formatting
 *
 * Pure types and formatting functions for structured timeline events.
 * This file has NO server/DB imports and is safe for client components.
 */

import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
  FREQUENCY_CONFIG,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import { FORMER_USER_NAME } from "~/lib/timeline/resolve-person";

/**
 * Structured timeline event payload.
 * Discriminated union on `type` — stored as jsonb in the `event_data` column.
 */
export type TimelineEventData =
  | {
      type: "assigned";
      /**
       * The assignee's account (PP-0fg0.1). Null once that account is
       * deleted, and on a legacy event whose name matched no single account.
       */
      assigneeId: string | null;
      /**
       * The assignee's name when the event was written. A rollback copy: it
       * lets a release that predates `assigneeId` render the event. Activity
       * shows it only when `assigneeId` is null or absent (a legacy name that
       * matched no single account, or an event written by the previous
       * release during the deploy). With an id, Activity never shows it: the
       * live name, or "Former user" once the account is gone. Account
       * deletion removes it.
       */
      assigneeName?: string;
    }
  | { type: "unassigned" }
  | { type: "status_changed"; from: string; to: string }
  | { type: "severity_changed"; from: string; to: string }
  | { type: "priority_changed"; from: string; to: string }
  | { type: "frequency_changed"; from: string; to: string }
  | { type: "comment_deleted"; deletedBy: "author" | "admin" }
  | { type: "title_changed"; from: string; to: string }
  | {
      type: "machine_reassigned";
      fromInitials: string;
      fromIssueNumber: number;
      fromMachineName: string;
      toInitials: string;
      toIssueNumber: number;
      toMachineName: string;
    };

/**
 * A stored event with its person references resolved to display names: what
 * the formatters render. Only an assignment refers to a person.
 */
export type ResolvedTimelineEvent =
  | Exclude<TimelineEventData, { type: "assigned" }>
  | { type: "assigned"; assigneeDisplayName: string };

/**
 * Resolve an event's person references against current account names (id →
 * name). An assignee with an id shows that account's current name, or the
 * deleted-account placeholder once the account is gone: never the stored
 * name, which would outlive an account deleted outside the app. Only an
 * event without an id falls back to its stored name.
 */
export function resolveTimelineEvent(
  event: TimelineEventData,
  accountNames: ReadonlyMap<string, string>
): ResolvedTimelineEvent {
  if (event.type !== "assigned") return event;
  // `typeof`, not `!== null`: an event written by the previous release while
  // migration 0101 deployed has no `assigneeId` key at all.
  const displayName =
    typeof event.assigneeId === "string"
      ? accountNames.get(event.assigneeId)
      : event.assigneeName;
  return {
    type: "assigned",
    assigneeDisplayName: displayName ?? FORMER_USER_NAME,
  };
}

/**
 * Convert a structured timeline event to a human-readable string.
 * Used by the timeline UI to display system events.
 */
export function formatTimelineEvent(event: ResolvedTimelineEvent): string {
  switch (event.type) {
    case "assigned":
      return `Assigned to ${event.assigneeDisplayName}`;
    case "unassigned":
      return "Unassigned";
    case "status_changed":
      return `Status changed from ${statusLabel(event.from)} to ${statusLabel(event.to)}`;
    case "severity_changed":
      return `Severity changed from ${severityLabel(event.from)} to ${severityLabel(event.to)}`;
    case "priority_changed":
      return `Priority changed from ${priorityLabel(event.from)} to ${priorityLabel(event.to)}`;
    case "frequency_changed":
      return `Frequency changed from ${frequencyLabel(event.from)} to ${frequencyLabel(event.to)}`;
    case "comment_deleted":
      return event.deletedBy === "author"
        ? "Comment deleted by author"
        : "Comment removed by admin";
    case "title_changed":
      return `Title changed from "${event.from}" to "${event.to}"`;
    case "machine_reassigned":
      return `Moved from ${formatIssueId(event.fromInitials, event.fromIssueNumber)} (${event.fromMachineName}) to ${formatIssueId(event.toInitials, event.toIssueNumber)} (${event.toMachineName})`;
    default:
      return assertUnreachableEvent(event);
  }
}

/**
 * The same event as a verb phrase that follows the actor's name on one line
 * ("changed priority Medium → High"), for the issue page's Activity (spec
 * issue-detail §7.5). Without an actor, use `formatTimelineEvent`.
 */
export function formatTimelineEventAction(
  event: ResolvedTimelineEvent
): string {
  switch (event.type) {
    case "assigned":
      return `assigned ${event.assigneeDisplayName}`;
    case "unassigned":
      return "unassigned the issue";
    case "status_changed":
      return `changed status ${statusLabel(event.from)} → ${statusLabel(event.to)}`;
    case "severity_changed":
      return `changed severity ${severityLabel(event.from)} → ${severityLabel(event.to)}`;
    case "priority_changed":
      return `changed priority ${priorityLabel(event.from)} → ${priorityLabel(event.to)}`;
    case "frequency_changed":
      return `changed frequency ${frequencyLabel(event.from)} → ${frequencyLabel(event.to)}`;
    case "comment_deleted":
      return event.deletedBy === "author"
        ? "deleted their comment"
        : "removed a comment";
    case "title_changed":
      return `changed the title "${event.from}" → "${event.to}"`;
    case "machine_reassigned":
      return `moved this from ${formatIssueId(event.fromInitials, event.fromIssueNumber)} (${event.fromMachineName}) → ${formatIssueId(event.toInitials, event.toIssueNumber)} (${event.toMachineName})`;
    default:
      return assertUnreachableEvent(event);
  }
}

function assertUnreachableEvent(_event: never): string {
  return "Unknown timeline event";
}

function statusLabel(value: string): string {
  const config = (
    STATUS_CONFIG as Record<string, { label: string } | undefined>
  )[value];
  return config?.label ?? value;
}

function severityLabel(value: string): string {
  const config = (
    SEVERITY_CONFIG as Record<string, { label: string } | undefined>
  )[value];
  return config?.label ?? value;
}

function priorityLabel(value: string): string {
  const config = (
    PRIORITY_CONFIG as Record<string, { label: string } | undefined>
  )[value];
  return config?.label ?? value;
}

function frequencyLabel(value: string): string {
  const config = (
    FREQUENCY_CONFIG as Record<string, { label: string } | undefined>
  )[value];
  return config?.label ?? value;
}
