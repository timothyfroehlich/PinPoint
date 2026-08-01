import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { APC_LOCATION_ID, PBM_MANUAL_SYNC_MIN_INTERVAL_MS } from "./config";
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

/**
 * Which caller kicked off a sync — decides throttle policy (PP-hbi0).
 *
 * - `"cron"`: the hourly automated refresh (the sanctioned one-call/hour,
 *   CORE-PBM-001). Never throttled; still records its attempt so a manual
 *   refresh right after respects the fresh snapshot.
 * - `"manual"`: any human-initiated refresh (Sync now, verify/reconnect, …).
 *   Rate-limited to at most one per `PBM_MANUAL_SYNC_MIN_INTERVAL_MS`. This is
 *   the default so every future live-fetch caller inherits the chokepoint
 *   unless it explicitly opts into the automated path.
 */
export type SyncTrigger = "manual" | "cron";

/** Outcome of a sync attempt. */
export type SyncResult =
  | { ok: true; machineCount: number; syncedAt: Date }
  | { ok: false; reason: "error"; error: string }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

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
 * Stamp `last_sync_attempt_at` at the START of a sync attempt.
 *
 * This is the single throttle chokepoint (PP-hbi0). It's a conditional upsert,
 * so the read-check-then-write is done atomically in one statement — a row-level
 * lock on the singleton serializes concurrent double-clicks and only one wins the
 * claim (TOCTOU-safe; `lastSyncedAt`-style completion timestamps could not
 * express this because they only advance after the fetch returns).
 *
 * - `guardIntervalMs === null` (cron/automated): unconditional stamp, always
 *   proceeds — returns `true`.
 * - `guardIntervalMs` a number (manual): the `DO UPDATE` only fires when the
 *   prior attempt is older than the interval (or absent). `RETURNING` yields no
 *   row when the guard refuses → returns `false` (throttled). Crucially the
 *   guard is against the last ATTEMPT, not the last success, so a failed fetch
 *   (429/500) still blocks repeat clicks instead of fail-opening (CORE-PBM-001).
 */
async function stampSyncAttempt(
  locationId: number,
  attemptAt: Date,
  guardIntervalMs: number | null
): Promise<boolean> {
  const values = {
    id: SINGLETON_ID,
    locationId,
    lastSyncAttemptAt: attemptAt,
    updatedAt: attemptAt,
  };
  const set = { lastSyncAttemptAt: attemptAt, updatedAt: attemptAt };

  if (guardIntervalMs === null) {
    await db
      .insert(pinballmapState)
      .values(values)
      .onConflictDoUpdate({ target: pinballmapState.id, set });
    return true;
  }

  const threshold = new Date(attemptAt.getTime() - guardIntervalMs);
  const claimed = await db
    .insert(pinballmapState)
    .values(values)
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set,
      setWhere: sql`${pinballmapState.lastSyncAttemptAt} is null or ${pinballmapState.lastSyncAttemptAt} < ${threshold}`,
    })
    .returning({ id: pinballmapState.id });
  return claimed.length > 0;
}

/** Milliseconds the caller should wait before a throttled manual retry. */
function retryAfterMs(lastAttempt: Date | null | undefined, now: Date): number {
  if (!lastAttempt) return PBM_MANUAL_SYNC_MIN_INTERVAL_MS;
  const elapsed = now.getTime() - lastAttempt.getTime();
  return Math.max(0, PBM_MANUAL_SYNC_MIN_INTERVAL_MS - elapsed);
}

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on the
 * singleton and returns `{ ok: false, reason: "error" }` so callers (cron, "Sync
 * now") can surface it without a 500.
 *
 * Throttle chokepoint (PP-hbi0): a `manual` trigger (the default) is rate-limited
 * to at most one call per `PBM_MANUAL_SYNC_MIN_INTERVAL_MS` and returns
 * `{ ok: false, reason: "throttled" }` when refused — enforced HERE so every
 * live-fetch caller (Sync now, verify/reconnect, any future caller) inherits one
 * guard. The `cron` trigger bypasses the interval (the sanctioned hourly refresh)
 * but still records its attempt, so a manual refresh moments after a cron respects
 * the just-fetched snapshot.
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
  trigger?: SyncTrigger;
}): Promise<SyncResult> {
  const trigger = opts?.trigger ?? "manual";
  const state = await getPinballMapState();
  const locationId = state?.locationId ?? APC_LOCATION_ID;
  const syncedAt = new Date();
  const actor = opts?.updatedBy ? { updatedBy: opts.updatedBy } : {};

  // Chokepoint: stamp the attempt before the fetch. Manual is guarded (throttled
  // + TOCTOU-safe); cron records unconditionally.
  const claimed = await stampSyncAttempt(
    locationId,
    syncedAt,
    trigger === "manual" ? PBM_MANUAL_SYNC_MIN_INTERVAL_MS : null
  );
  if (!claimed) {
    return {
      ok: false,
      reason: "throttled",
      retryAfterMs: retryAfterMs(state?.lastSyncAttemptAt, syncedAt),
    };
  }

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
    return { ok: false, reason: "error", error: message };
  }
}
