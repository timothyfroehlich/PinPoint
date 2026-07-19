import "server-only";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { APC_LOCATION_ID } from "./config";
import type { NewPinballmapState, PinballmapState } from "~/lib/types/database";

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
 * Upsert the singleton, writing the given health fields. `id` is fixed and the
 * differing fields (snapshot, health, actor) are passed by the caller, so the ok
 * and error paths can't drift. The `set` reuses the same fields, so a key omitted
 * by the caller (e.g. `snapshotJson`/`lastSyncedAt` on the error path) is left
 * untouched on an existing row rather than clobbered.
 */
async function upsertState(
  fields: Omit<NewPinballmapState, "id"> & { locationId: number }
): Promise<void> {
  await db
    .insert(pinballmapState)
    .values({ id: SINGLETON_ID, ...fields })
    .onConflictDoUpdate({ target: pinballmapState.id, set: fields });
}

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on the
 * singleton and returns `{ ok: false }` so callers (cron, "Sync now") can surface
 * it without a 500.
 *
 * Does NOT gate on `state.enabled` — this is the pure read-path mechanism and the
 * caller owns the "should we sync at all" decision (the PP-o355.11 cron checks
 * `enabled`/connection before calling; CORE-PBM-001). `lastSyncedAt` means "last
 * SUCCESSFUL sync" and is only written on the ok path, so downstream freshness
 * math (`now - lastSyncedAt`, PP-o355.11 status card) isn't fooled by a failed
 * attempt over a stale snapshot — read `lastSyncStatus` for attempt outcome.
 */
export async function syncLocationSnapshot(opts?: {
  updatedBy?: string;
}): Promise<SyncResult> {
  const state = await getPinballMapState();
  const locationId = state?.locationId ?? APC_LOCATION_ID;
  const syncedAt = new Date();
  const actor = opts?.updatedBy ? { updatedBy: opts.updatedBy } : {};

  try {
    const snapshot = await (
      await getPinballMapClient()
    ).fetchLocation(locationId);
    await upsertState({
      locationId,
      snapshotJson: snapshot,
      lastSyncedAt: syncedAt,
      lastSyncStatus: "ok",
      lastSyncError: null,
      updatedAt: syncedAt,
      ...actor,
    });
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    // Note: no `lastSyncedAt` here — a failed attempt must not advance the
    // last-successful-sync clock. `updatedAt` still records that we wrote.
    await upsertState({
      locationId,
      lastSyncStatus: "error",
      lastSyncError: message,
      updatedAt: syncedAt,
      ...actor,
    });
    return { ok: false, error: message };
  }
}
