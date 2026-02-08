/**
 * Timeline Event Helpers
 *
 * Creates system-generated timeline events for issue updates.
 * Timeline events are stored as issue_comments with is_system: true.
 */

import { db, type DbTransaction } from "~/server/db";
import { issueComments } from "~/server/db/schema";

/**
 * Create a system timeline event for an issue
 *
 * System events appear in the timeline as single-line entries,
 * not as full comment boxes.
 *
 * @param issueId - The issue to add the event to
 * @param content - The event description (e.g., "Status changed from new to in_progress")
 * @param tx - Optional database transaction
 * @param actorId - Optional user ID of the person who performed the action
 *
 * @example
 * ```ts
 * await createTimelineEvent(issueId, "Status changed from new to in_progress", db, userId);
 * await createTimelineEvent(issueId, "Assigned to John Doe", tx, actorId);
 * await createTimelineEvent(issueId, "Marked as closed");
 * ```
 */
export async function createTimelineEvent(
  issueId: string,
  content: string,
  tx: DbTransaction = db,
  actorId?: string | null
): Promise<void> {
  await tx.insert(issueComments).values({
    issueId,
    content,
    isSystem: true,
    authorId: actorId ?? null,
  });
}
