/**
 * Timeline Event Helpers
 *
 * Creates system-generated timeline events for issue updates.
 * Timeline events are stored as issue_comments with is_system: true.
 */

import { inArray } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { issueComments, userProfiles } from "~/server/db/schema";

// Import then re-export types and formatting from the client-safe module
import {
  type ResolvedTimelineEvent,
  type TimelineEventData,
  formatTimelineEvent,
  resolveTimelineEvent,
} from "~/lib/timeline/types";
export { type TimelineEventData, formatTimelineEvent };

/**
 * Resolve the person references in a page of issue Activity to current
 * account names (PP-0fg0.1): one query for every assignee the page mentions,
 * so a rename shows on every past assignment and a deleted account shows the
 * placeholder.
 */
export async function resolveIssueActivityEvents<
  T extends { eventData: TimelineEventData | null },
>(
  entries: readonly T[],
  tx: DbTransaction = db
): Promise<
  (Omit<T, "eventData"> & { eventData: ResolvedTimelineEvent | null })[]
> {
  const assigneeIds = new Set<string>();
  for (const { eventData } of entries) {
    // `typeof`, not `!== null`: an event written by the previous release while
    // migration 0100 deployed has no `assigneeId` key at all.
    if (
      eventData?.type === "assigned" &&
      typeof eventData.assigneeId === "string"
    ) {
      assigneeIds.add(eventData.assigneeId);
    }
  }

  const accountNames = new Map<string, string>();
  if (assigneeIds.size > 0) {
    const rows = await tx
      .select({ id: userProfiles.id, name: userProfiles.name })
      .from(userProfiles)
      .where(inArray(userProfiles.id, [...assigneeIds]));
    for (const row of rows) accountNames.set(row.id, row.name);
  }

  return entries.map((entry) => ({
    ...entry,
    eventData: entry.eventData
      ? resolveTimelineEvent(entry.eventData, accountNames)
      : null,
  }));
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
 * await createTimelineEvent(issueId, { type: "assigned", assigneeId }, tx, actorId);
 * await createTimelineEvent(issueId, { type: "unassigned" });
 * ```
 */
export async function createTimelineEvent(
  issueId: string,
  event: TimelineEventData,
  tx: DbTransaction = db,
  actorId?: string | null
): Promise<string> {
  const [row] = await tx
    .insert(issueComments)
    .values({
      issueId,
      eventData: event,
      isSystem: true,
      authorId: actorId ?? null,
    })
    .returning({ id: issueComments.id });
  if (!row) throw new Error("Failed to insert issue timeline event");
  return row.id;
}
