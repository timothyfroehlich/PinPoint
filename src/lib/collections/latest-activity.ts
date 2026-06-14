import { and, desc, inArray, isNull } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { timelineEvents } from "~/server/db/schema";
import type { TimelineTag } from "~/lib/timeline/machine-tags";

export interface LatestActivity {
  createdAt: Date;
  tag: TimelineTag;
}

/**
 * Newest non-deleted timeline event per machine, for the Overview
 * "last activity" column. One DISTINCT ON query — not N per machine.
 */
export async function getLatestTimelineEventPerMachine(
  tx: DbTransaction = db,
  machineIds: string[]
): Promise<Map<string, LatestActivity>> {
  if (machineIds.length === 0) return new Map();

  const rows = await tx
    .selectDistinctOn([timelineEvents.machineId], {
      machineId: timelineEvents.machineId,
      createdAt: timelineEvents.createdAt,
      tag: timelineEvents.tag,
    })
    .from(timelineEvents)
    .where(
      and(
        inArray(timelineEvents.machineId, machineIds),
        isNull(timelineEvents.deletedAt)
      )
    )
    .orderBy(
      timelineEvents.machineId,
      desc(timelineEvents.createdAt),
      desc(timelineEvents.sequence)
    );

  const map = new Map<string, LatestActivity>();
  for (const row of rows) {
    if (row.machineId !== null) {
      map.set(row.machineId, { createdAt: row.createdAt, tag: row.tag });
    }
  }
  return map;
}
