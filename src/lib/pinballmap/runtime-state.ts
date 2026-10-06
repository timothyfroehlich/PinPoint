import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import type { PinballmapRuntimeState } from "~/lib/types";
import { PINBALLMAP_STATE_ID } from "./mutation-lease";

/**
 * PinballMap location-snapshot read path (foundation — PP-o355.16).
 *
 * The integration keeps one `pinballmap_state` singleton row. A sync fetches our
 * location's full JSON through the client seam and stores the WHOLE snapshot, so
 * every downstream surface (status card, desync view, link/verify) reads the
 * stored snapshot rather than hitting PBM per request — PBM's "one call per hour"
 * conduct (CORE-PBM-001). The fetch is a side effect performed OUTSIDE any
 * transaction (CORE-ARCH-011); we persist the result after it returns.
 *
 * PP-o355.11 schedules `syncLocationSnapshot` on a cron; PP-o355.12 reuses the
 * persisted snapshot to resolve/verify lmx handles.
 */

/** Read the integration-state singleton (null when never initialized). */
export async function getPinballMapState(): Promise<PinballmapRuntimeState | null> {
  const [row] = await db
    .select({
      id: pinballmapState.id,
      locationId: pinballmapState.locationId,
      configurationGeneration: pinballmapState.configurationGeneration,
      mutationLeaseId: pinballmapState.mutationLeaseId,
      mutationLeaseExpiresAt: pinballmapState.mutationLeaseExpiresAt,
      snapshotJson: pinballmapState.snapshotJson,
      snapshotRevision: pinballmapState.snapshotRevision,
      lastSyncedAt: pinballmapState.lastSyncedAt,
      lastSyncAttemptAt: pinballmapState.lastSyncAttemptAt,
      lastSyncStatus: pinballmapState.lastSyncStatus,
      lastSyncError: pinballmapState.lastSyncError,
      refreshTokens: pinballmapState.refreshTokens,
      refreshTokensAt: pinballmapState.refreshTokensAt,
      regionAlertRegion: pinballmapState.regionAlertRegion,
      regionAlertChannelId: pinballmapState.regionAlertChannelId,
      regionAlertStatus: pinballmapState.regionAlertStatus,
      regionAlertLastPostAt: pinballmapState.regionAlertLastPostAt,
      regionAlertLastStatusDetail: pinballmapState.regionAlertLastStatusDetail,
      updatedAt: pinballmapState.updatedAt,
      updatedBy: pinballmapState.updatedBy,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID))
    .limit(1);
  return row ?? null;
}

/** Raw RETURNING differs between postgres-js (array) and PGlite ({ rows }). */
export function hasReturnedRow(result: unknown): boolean {
  if (Array.isArray(result)) return result.length > 0;
  if (typeof result !== "object" || result === null || !("rows" in result)) {
    return false;
  }
  return Array.isArray(result.rows) && result.rows.length > 0;
}
