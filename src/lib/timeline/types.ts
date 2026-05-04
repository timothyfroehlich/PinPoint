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

/**
 * Structured timeline event payload.
 * Discriminated union on `type` — stored as jsonb in the `event_data` column.
 */
export type TimelineEventData =
  | { type: "assigned"; assigneeName: string }
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
 * Convert a structured timeline event to a human-readable string.
 * Used by the timeline UI to display system events.
 */
export function formatTimelineEvent(event: TimelineEventData): string {
  switch (event.type) {
    case "assigned":
      return `Assigned to ${event.assigneeName}`;
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
        ? "User deleted their comment"
        : "Comment removed by admin";
    case "title_changed":
      return `Title changed from "${event.from}" to "${event.to}"`;
    case "machine_reassigned":
      return `Moved from ${event.fromInitials}-${event.fromIssueNumber.toString()} (${event.fromMachineName}) to ${event.toInitials}-${event.toIssueNumber.toString()} (${event.toMachineName})`;
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
