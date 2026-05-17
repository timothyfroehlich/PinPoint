/**
 * Machine Timeline Write Helpers
 *
 * Pure DB write functions for the `timeline_events` table. Each helper accepts
 * an optional `DbTransaction` so callers can compose them inside larger
 * transactions (e.g., server actions that mutate a machine and emit a
 * lifecycle event atomically).
 *
 * Type-level guarantees:
 * - `createMachineTimelineEvent` requires `sourceType` to be a system source
 *   (`lifecycle` or `issue`) and always stores structured `eventData`.
 * - `createMachineComment` always sets `sourceType='comment'` and stores a
 *   ProseMirror document in `content`.
 * - `softDeleteMachineComment` only sets the tombstone columns; it does not
 *   mutate `content`, allowing UI/audit views to show "[deleted]" while still
 *   preserving the original payload.
 *
 * Tag validation (reserved vs user-tag) happens at the server-action boundary
 * via `userTagSchema` from `~/lib/timeline/machine-tags` — these helpers
 * accept any `TimelineTag` and assume the caller has validated.
 */

import { eq } from "drizzle-orm";

import type { MachineTimelineEventData } from "~/lib/timeline/machine-event-types";
import type { TimelineTag } from "~/lib/timeline/machine-tags";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import { db, type DbTransaction } from "~/server/db";
import { timelineEvents } from "~/server/db/schema";

type SystemSourceType = "lifecycle" | "issue";

export interface CreateTimelineEventArgs {
  sourceType: SystemSourceType;
  tag: TimelineTag;
  eventData: MachineTimelineEventData;
  actorId?: string;
}

export interface CreateMachineCommentArgs {
  content: ProseMirrorDoc;
  tag: TimelineTag;
  authorId: string;
}

export interface SoftDeleteArgs {
  deletedBy: string;
}

/**
 * Insert a system-emitted timeline event (lifecycle or duplicated issue event).
 *
 * `content` is left null; the row is rendered from `eventData` by the
 * timeline UI.
 */
export async function createMachineTimelineEvent(
  machineId: string,
  args: CreateTimelineEventArgs,
  tx: DbTransaction = db
): Promise<void> {
  await tx.insert(timelineEvents).values({
    machineId,
    sourceType: args.sourceType,
    tag: args.tag,
    eventData: args.eventData,
    authorId: args.actorId ?? null,
  });
}

/**
 * Insert a user-authored comment on a machine timeline.
 *
 * `eventData` is left null; the row is rendered from `content` (a
 * ProseMirror document) by the timeline UI.
 */
export async function createMachineComment(
  machineId: string,
  args: CreateMachineCommentArgs,
  tx: DbTransaction = db
): Promise<void> {
  await tx.insert(timelineEvents).values({
    machineId,
    sourceType: "comment",
    tag: args.tag,
    content: args.content,
    authorId: args.authorId,
  });
}

/**
 * Soft-delete a comment by stamping `deletedAt` and `deletedBy`.
 *
 * Intentionally does NOT clear `content` — UI can render "[deleted by X]"
 * while preserving the original document for audit/recovery.
 */
export async function softDeleteMachineComment(
  id: string,
  args: SoftDeleteArgs,
  tx: DbTransaction = db
): Promise<void> {
  await tx
    .update(timelineEvents)
    .set({
      deletedAt: new Date(),
      deletedBy: args.deletedBy,
    })
    .where(eq(timelineEvents.id, id));
}
