import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { APC_LOCATION_ID } from "./config";
import type { PinballmapState } from "~/lib/types/database";

/**
 * PinballMap location-snapshot sync (bead C / PP-o355.3).
 *
 * The integration keeps one `pinballmap_state` singleton row. A sync fetches our
 * location's full JSON through the client seam and stores the WHOLE snapshot, so
 * every downstream surface (status card, desync view, comment ingestion) reads
 * the stored snapshot rather than hitting PBM per request — PBM's "one call per
 * hour" conduct. The fetch is a side effect performed OUTSIDE any transaction
 * (CORE-ARCH-011); we persist the result after it returns.
 */

const SINGLETON_ID = "singleton";

/** Read the integration-state singleton (null when never initialized). */
export async function getPinballMapState(): Promise<PinballmapState | null> {
  const [row] = await db
    .select()
    .from(pinballmapState)
    .where(eq(pinballmapState.id, SINGLETON_ID))
    .limit(1);
  return row ?? null;
}

/** Outcome of a sync attempt. */
export type SyncResult =
  | { ok: true; machineCount: number; syncedAt: Date }
  | { ok: false; error: string };

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on
 * the singleton and returns `{ ok: false }` so callers (cron route, "Sync now")
 * can surface it without a 500.
 */
export async function syncLocationSnapshot(opts?: {
  updatedBy?: string;
}): Promise<SyncResult> {
  const state = await getPinballMapState();
  const locationId = state?.locationId ?? APC_LOCATION_ID;
  const syncedAt = new Date();

  try {
    const snapshot = await getPinballMapClient().fetchLocation(locationId);
    await db
      .insert(pinballmapState)
      .values({
        id: SINGLETON_ID,
        locationId,
        snapshotJson: snapshot,
        lastSyncedAt: syncedAt,
        lastSyncStatus: "ok",
        lastSyncError: null,
        updatedAt: syncedAt,
        ...(opts?.updatedBy ? { updatedBy: opts.updatedBy } : {}),
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          snapshotJson: snapshot,
          lastSyncedAt: syncedAt,
          lastSyncStatus: "ok",
          lastSyncError: null,
          updatedAt: syncedAt,
          ...(opts?.updatedBy ? { updatedBy: opts.updatedBy } : {}),
        },
      });
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db
      .insert(pinballmapState)
      .values({
        id: SINGLETON_ID,
        locationId,
        lastSyncedAt: syncedAt,
        lastSyncStatus: "error",
        lastSyncError: message,
        updatedAt: syncedAt,
      })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: {
          lastSyncedAt: syncedAt,
          lastSyncStatus: "error",
          lastSyncError: message,
          updatedAt: syncedAt,
        },
      });
    return { ok: false, error: message };
  }
}

// Pure status derivation lives in ./status (no server-only, no DB) so the Info
// card and unit tests can use it without pulling in the DB client.
export {
  shouldBeListedOnPbm,
  derivePbmMachineStatus,
  type PbmMachineStatus,
} from "./status";
