/**
 * Timeline Event Helpers
 *
 * Creates system-generated timeline events for issue updates.
 * Timeline events are stored as issue_comments with is_system: true.
 */

import { db, type DbOrTx } from "~/server/db";
import { issueComments } from "~/server/db/schema";

/**
 * Create a system timeline event for an issue
 *
 * System events appear in the timeline as single-line entries,
 * not as full comment boxes.
 *
 * @param issueId - The issue to add the event to
 * @param content - The event description (e.g., "Status changed from new to in_progress")
 *
 * @example
 * ```ts
 * await createTimelineEvent(issueId, "Status changed from new to in_progress");
 * await createTimelineEvent(issueId, "Assigned to John Doe");
 * await createTimelineEvent(issueId, "Marked as resolved");
 * ```
 */
export async function createTimelineEvent(
  issueId: string,
  content: string,
  tx: DbOrTx = db
): Promise<void> {
  await tx.insert(issueComments).values({
    issueId,
    content,
    isSystem: true,
    authorId: null, // System events have no author
  });
}
