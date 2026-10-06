import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import type { PinballmapRuntimeState } from "~/lib/types";
import { PINBALLMAP_STATE_ID } from "./mutation-lease";

/**
 * Reads of the `pinballmap_state` singleton row, shared by every module that
 * owns part of it (`./mutation-lease`, `./refresh-allowance`,
 * `./location-sync`, `./tracked-location`).
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
