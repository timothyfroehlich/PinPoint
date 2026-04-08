/**
 * Timeline Event Helpers
 *
 * Creates system-generated timeline events for issue updates.
 * Timeline events are stored as issue_comments with is_system: true.
 */

import { db, type DbTransaction } from "~/server/db";
import { issueComments } from "~/server/db/schema";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
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
  | { type: "frequency_changed"; from: string; to: string };

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
  }
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

/**
 * Create a system timeline event for an issue
 *
 * System events appear in the timeline as single-line entries,
 * not as full comment boxes. The structured event is stored in
 * the `event_data` column and rendered via `formatTimelineEvent`.
 *
 * @param issueId - The issue to add the event to
 * @param event - The structured event payload (discriminated union on `type`)
 * @param tx - Optional database transaction
 * @param actorId - Optional user ID of the person who performed the action
 *
 * @example
 * ```ts
 * await createTimelineEvent(issueId, { type: "status_changed", from: "new", to: "in_progress" }, db, userId);
 * await createTimelineEvent(issueId, { type: "assigned", assigneeName: "John Doe" }, tx, actorId);
 * await createTimelineEvent(issueId, { type: "unassigned" });
 * ```
 */
export async function createTimelineEvent(
  issueId: string,
  event: TimelineEventData,
  tx: DbTransaction = db,
  actorId?: string | null
): Promise<void> {
  await tx.insert(issueComments).values({
    issueId,
    eventData: event,
    content: { type: "doc", content: [] } as ProseMirrorDoc,
    isSystem: true,
    authorId: actorId ?? null,
  });
}
