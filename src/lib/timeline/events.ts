/**
 * Timeline Event Helpers
 *
 * Creates system-generated timeline events for issue updates.
 * Timeline events are stored as issue_comments with is_system: true.
 */

import { db, type DbTransaction } from "~/server/db";
import { issueComments } from "~/server/db/schema";

// Import then re-export types and formatting from the client-safe module
import {
  type TimelineEventData,
  formatTimelineEvent,
} from "~/lib/timeline/types";
export { type TimelineEventData, formatTimelineEvent };

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
    isSystem: true,
    authorId: actorId ?? null,
  });
}
