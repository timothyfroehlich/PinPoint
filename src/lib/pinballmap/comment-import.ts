import "server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { log } from "~/lib/logger";
import {
  dispatchNotification,
  getChannels,
  planNotification,
  type DeliveryPlan,
} from "~/lib/notifications/dispatch";
import { db } from "~/server/db";
import {
  machines,
  pinballmapComments,
  pinballmapState,
  timelineEvents,
} from "~/server/db/schema";
import { pinballmapCommenterName } from "./comment-conversion";
import type { PbmCondition, PbmLmx } from "./types";

/**
 * Import Pinball Map condition comments into covering machine timelines
 * (pinballmap spec 7.1, 7.4; PP-o355.4).
 *
 * Reads the stored snapshot only — no Pinball Map HTTP (CORE-PBM-001,
 * CORE-ARCH-011) — so it is safe to run after any sync and after any local
 * change that alters coverage, such as an intent toggle.
 *
 * Each comment is recorded once in `pinballmap_comments` (its identity across
 * copies, spec 7.8), then copied into the timeline of every same-title machine
 * whose intent is On. Machines set to Off or Don't sync receive nothing. Both
 * inserts are ON CONFLICT DO NOTHING against unique keys, so repeated and
 * concurrent runs converge on exactly one copy per timeline.
 *
 * A copy is dated with the comment's own Pinball Map timestamp, so a
 * historical backfill lands where it happened rather than at import time.
 *
 * Each new copy notifies the owner and watchers of its machine (spec 7.4,
 * 7.7): one notification per copy, so someone watching two covering machines
 * hears about each. In-app rows are written with the copies; email and Discord
 * go out after the import commits.
 */

/** A timeline copy this run created. */
export interface ImportedCommentCopy {
  machineId: string;
  conditionId: number;
  /**
   * True when the comment was first observed by this run after the location's
   * silent backfill (spec 7.4). Historical comments, and comments a machine
   * receives only because its coverage changed, are false.
   */
  isNew: boolean;
  /** The copy's timeline event; identifies its notifications (spec 7.7). */
  timelineEventId: string;
}

export interface CommentImportResult {
  /** Comments recorded for the first time by this run. */
  commentsObserved: number;
  /** Timeline copies created by this run. */
  copies: ImportedCommentCopy[];
  /** True when this run was the tracked location's silent historical import. */
  backfill: boolean;
}

const EMPTY_RESULT: CommentImportResult = {
  commentsObserved: 0,
  copies: [],
  backfill: false,
};

// Bounds each multi-row INSERT well under Postgres's bind-parameter limit.
const INSERT_CHUNK = 500;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

interface DatedCondition {
  lmx: PbmLmx;
  condition: PbmCondition;
  commentedAt: Date;
}

function datedConditions(lmxes: readonly PbmLmx[]): DatedCondition[] {
  const out: DatedCondition[] = [];
  for (const lmx of lmxes) {
    for (const condition of lmx.conditions) {
      const commentedAt = new Date(condition.createdAtIso);
      // A timestamp PBM sent that does not parse would fail the whole insert.
      // Skip that one comment rather than blocking every other import.
      if (Number.isNaN(commentedAt.getTime())) continue;
      out.push({ lmx, condition, commentedAt });
    }
  }
  return out;
}

/**
 * Import every comment in the stored snapshot into covering timelines.
 *
 * A no-op while Pinball Map is not configured, before a snapshot exists, or
 * when the stored snapshot belongs to a different location than the one
 * tracked (a lineup must never be attributed to the wrong venue).
 */
export async function importPinballMapComments(): Promise<CommentImportResult> {
  // Resolved before the transaction: the Discord channel reads its config
  // through a Vault RPC, which must not run inside one (CORE-ARCH-011).
  const channels = await getChannels();
  const deliveries: DeliveryPlan["deliveries"] = [];

  const result = await db.transaction(async (tx) => {
    // Row lock: serializes the backfill decision against a concurrent import
    // and against a configuration change swapping the location underneath.
    const [state] = await tx
      .select({
        locationId: pinballmapState.locationId,
        snapshot: pinballmapState.snapshotJson,
        baselineLocationId: pinballmapState.commentsBaselineLocationId,
      })
      .from(pinballmapState)
      .where(eq(pinballmapState.id, "singleton"))
      .for("update");
    if (!state || state.locationId === null || !state.snapshot) {
      return EMPTY_RESULT;
    }
    const { locationId, snapshot } = state;
    if (snapshot.locationId !== locationId) return EMPTY_RESULT;

    const backfill = state.baselineLocationId !== locationId;
    const conditions = datedConditions(snapshot.lmxes);

    const newlyObserved = new Set<number>();
    for (const batch of chunk(conditions, INSERT_CHUNK)) {
      const inserted = await tx
        .insert(pinballmapComments)
        .values(
          batch.map(({ lmx, condition, commentedAt }) => ({
            conditionId: condition.id,
            locationId,
            pinballmapMachineId: lmx.machineId,
            lmxId: lmx.id,
            comment: condition.comment,
            username: condition.username,
            commentedAt,
          }))
        )
        .onConflictDoNothing()
        .returning({ conditionId: pinballmapComments.conditionId });
      for (const row of inserted) newlyObserved.add(row.conditionId);
    }

    const titles = [...new Set(conditions.map(({ lmx }) => lmx.machineId))];
    const covering =
      titles.length === 0
        ? []
        : await tx
            .select({
              id: machines.id,
              name: machines.name,
              initials: machines.initials,
              pinballmapMachineId: machines.pinballmapMachineId,
            })
            .from(machines)
            .where(
              and(
                eq(machines.pinballmapIntent, "on"),
                isNotNull(machines.pinballmapMachineId),
                inArray(machines.pinballmapMachineId, titles)
              )
            );
    const coveringByTitle = new Map<number, string[]>();
    for (const m of covering) {
      if (m.pinballmapMachineId === null) continue;
      const ids = coveringByTitle.get(m.pinballmapMachineId) ?? [];
      ids.push(m.id);
      coveringByTitle.set(m.pinballmapMachineId, ids);
    }

    const copyValues = conditions.flatMap(({ lmx, condition, commentedAt }) =>
      (coveringByTitle.get(lmx.machineId) ?? []).map((machineId) => ({
        machineId,
        createdAt: commentedAt,
        sourceType: "pinballmap" as const,
        tag: "pinballmap" as const,
        eventData: {
          kind: "pinballmap_comment" as const,
          conditionId: condition.id,
        },
      }))
    );

    const copies: ImportedCommentCopy[] = [];
    for (const batch of chunk(copyValues, INSERT_CHUNK)) {
      const inserted = await tx
        .insert(timelineEvents)
        .values(batch)
        .onConflictDoNothing()
        .returning({
          id: timelineEvents.id,
          machineId: timelineEvents.machineId,
          eventData: timelineEvents.eventData,
        });
      for (const row of inserted) {
        if (
          row.machineId === null ||
          row.eventData?.kind !== "pinballmap_comment"
        ) {
          continue;
        }
        const { conditionId } = row.eventData;
        copies.push({
          machineId: row.machineId,
          conditionId,
          isNew: !backfill && newlyObserved.has(conditionId),
          timelineEventId: row.id,
        });
      }
    }

    const newCopies = copies.filter((copy) => copy.isNew);
    if (newCopies.length > 0) {
      const machineById = new Map(covering.map((m) => [m.id, m]));
      const conditionById = new Map(
        conditions.map(({ condition }) => [condition.id, condition])
      );
      for (const copy of newCopies) {
        const condition = conditionById.get(copy.conditionId);
        const machine = machineById.get(copy.machineId);
        if (!condition) continue;
        const plan = await planNotification(
          {
            type: "pinballmap_comment",
            resourceType: "machine",
            resourceId: copy.machineId,
            machineName: machine?.name,
            machineInitials: machine?.initials,
            commentContent: condition.comment,
            actorName: pinballmapCommenterName(condition.username),
            pinballmapLocationId: locationId,
            eventId: copy.timelineEventId,
          },
          tx,
          channels
        );
        deliveries.push(...plan.deliveries);
      }
    }

    if (backfill) {
      await tx
        .update(pinballmapState)
        .set({ commentsBaselineLocationId: locationId })
        .where(eq(pinballmapState.id, "singleton"));
    }

    return { commentsObserved: newlyObserved.size, copies, backfill };
  });

  await dispatchNotification({ deliveries });
  return result;
}

/**
 * Run the import after a local change that alters coverage — an intent toggle
 * or a re-match — so a machine that just turned On shows its entry's comments
 * without waiting for the hourly sync.
 *
 * Best-effort: the change itself has already committed, and the next sync
 * imports anything this misses, so a failure is logged rather than reported to
 * the person who made the change.
 */
export async function importPinballMapCommentsAfterCoverageChange(): Promise<void> {
  try {
    await importPinballMapComments();
  } catch (error) {
    log.error(
      { err: error, action: "pinballmap.importComments" },
      "Pinball Map comment import after a coverage change failed"
    );
  }
}
