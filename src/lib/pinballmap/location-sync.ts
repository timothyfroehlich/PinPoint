import "server-only";
import { sql } from "drizzle-orm";
import { db } from "~/server/db";
import { errorMessage } from "~/lib/errors";
import type { PinballmapRuntimeState } from "~/lib/types";
import { getPinballMapClient } from "./client";
import { PINBALLMAP_STATE_ID, hasActiveMutationLease } from "./mutation-lease";
import { refreshRetryAfterMs, stampSyncAttempt } from "./refresh-allowance";
import { getPinballMapState, hasReturnedRow } from "./runtime-state";

/**
 * Which caller kicked off a sync — decides throttle policy (PP-hbi0).
 *
 * - `"cron"`: the hourly automated refresh (the sanctioned one-call/hour,
 *   CORE-PBM-001). Never throttled; still records its attempt so a manual
 *   refresh right after respects the fresh snapshot.
 * - `"manual"`: any human-initiated refresh (the control's Refresh button, the
 *   remove path's freshness check, …). Draws a token from the shared bucket.
 *   This is the default so every future live-fetch caller inherits the
 *   chokepoint unless it explicitly opts into the automated path.
 */
export type SyncTrigger = "manual" | "cron";

/** Outcome of a sync attempt. */
type SyncFailure =
  | { ok: false; reason: "error"; error: string }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "superseded" }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

export type SyncResult =
  { ok: true; machineCount: number; syncedAt: Date } | SyncFailure;

interface SyncOptions {
  updatedBy?: string;
  trigger?: SyncTrigger;
  mutationLeaseId?: string;
}

/**
 * These raw upserts name only the columns a sync owns, so a write never touches
 * configuration or lease state. The error path omits the last good snapshot and
 * timestamp so an unsuccessful fetch cannot clobber them. The serialized JSON
 * is cast through text before jsonb so postgres-js cannot double-encode it.
 */
async function recordSyncSuccess(
  locationId: number,
  configurationGeneration: number,
  snapshot: NonNullable<PinballmapRuntimeState["snapshotJson"]>,
  syncedAt: Date,
  updatedBy: string | undefined
): Promise<boolean> {
  const written = await db.execute(sql`
    INSERT INTO "pinballmap_state" (
      "id",
      "location_id",
      "snapshot_json",
      "snapshot_revision",
      "last_synced_at",
      "last_sync_status",
      "last_sync_error",
      "updated_at",
      "updated_by"
    )
    VALUES (
      ${PINBALLMAP_STATE_ID},
      ${locationId},
      ${JSON.stringify(snapshot)}::text::jsonb,
      1,
      ${syncedAt.toISOString()}::timestamptz,
      'ok',
      NULL,
      ${syncedAt.toISOString()}::timestamptz,
      ${updatedBy ?? null}::uuid
    )
    ON CONFLICT ("id") DO UPDATE SET
      "location_id" = EXCLUDED."location_id",
      "snapshot_json" = EXCLUDED."snapshot_json",
      "snapshot_revision" = "pinballmap_state"."snapshot_revision" + 1,
      "last_synced_at" = EXCLUDED."last_synced_at",
      "last_sync_status" = EXCLUDED."last_sync_status",
      "last_sync_error" = EXCLUDED."last_sync_error",
      "updated_at" = EXCLUDED."updated_at",
      "updated_by" = COALESCE(
        EXCLUDED."updated_by",
        "pinballmap_state"."updated_by"
      )
    WHERE "pinballmap_state"."location_id" = ${locationId}
      AND "pinballmap_state"."configuration_generation" = ${configurationGeneration}
    RETURNING "id"
  `);
  return hasReturnedRow(written);
}

async function recordSyncFailure(
  locationId: number,
  configurationGeneration: number,
  message: string,
  attemptedAt: Date,
  updatedBy: string | undefined
): Promise<boolean> {
  const written = await db.execute(sql`
    INSERT INTO "pinballmap_state" (
      "id",
      "location_id",
      "last_sync_status",
      "last_sync_error",
      "updated_at",
      "updated_by"
    )
    VALUES (
      ${PINBALLMAP_STATE_ID},
      ${locationId},
      'error',
      ${message},
      ${attemptedAt.toISOString()}::timestamptz,
      ${updatedBy ?? null}::uuid
    )
    ON CONFLICT ("id") DO UPDATE SET
      "location_id" = EXCLUDED."location_id",
      "last_sync_status" = EXCLUDED."last_sync_status",
      "last_sync_error" = EXCLUDED."last_sync_error",
      "updated_at" = EXCLUDED."updated_at",
      "updated_by" = COALESCE(
        EXCLUDED."updated_by",
        "pinballmap_state"."updated_by"
      )
    WHERE "pinballmap_state"."location_id" = ${locationId}
      AND "pinballmap_state"."configuration_generation" = ${configurationGeneration}
    RETURNING "id"
  `);
  return hasReturnedRow(written);
}

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on the
 * singleton and returns `{ ok: false, reason: "error" }` so callers (cron, "Sync
 * now") can surface it without a 500.
 *
 * Throttle chokepoint (PP-hbi0, spec 3.2): a `manual` trigger (the default)
 * spends a token from the shared burst allowance and returns
 * `{ ok: false, reason: "throttled" }` when the bucket is empty — enforced HERE
 * so every live-fetch caller (the Refresh button, the remove path's freshness
 * check, any future caller) inherits one guard. The `cron` trigger spends no
 * token (the sanctioned hourly refresh) but still records its attempt.
 *
 * A configured location is required before the throttle claim or client lookup,
 * so an unconfigured integration spends no allowance and makes no PBM call.
 * `lastSyncedAt` means "last
 * SUCCESSFUL sync" and is only written on the ok path, so downstream freshness
 * math (`now - lastSyncedAt`, PP-o355.11 status card) isn't fooled by a failed
 * attempt over a stale snapshot — read `lastSyncStatus` for attempt outcome.
 */
export async function syncLocationSnapshot(
  opts?: SyncOptions
): Promise<SyncResult> {
  const trigger = opts?.trigger ?? "manual";
  const mutationLeaseId = opts?.mutationLeaseId;
  const state = await getPinballMapState();
  const trackedLocationId = state?.locationId ?? null;
  const configurationGeneration = state?.configurationGeneration ?? 0;
  if (trackedLocationId === null) {
    return { ok: false, reason: "not_configured" };
  }
  const syncedAt = new Date();

  // Chokepoint: stamp the attempt before the fetch. Manual spends a token
  // (TOCTOU-safe); cron records unconditionally.
  const claimed = await stampSyncAttempt(
    trackedLocationId,
    configurationGeneration,
    syncedAt,
    trigger === "manual",
    true,
    mutationLeaseId
  );
  if (!claimed) {
    const current = await getPinballMapState();
    if (
      (current?.locationId ?? null) !== trackedLocationId ||
      (current?.configurationGeneration ?? 0) !== configurationGeneration
    ) {
      return { ok: false, reason: "superseded" };
    }
    if (
      mutationLeaseId !== undefined &&
      current?.mutationLeaseId !== mutationLeaseId
    ) {
      return { ok: false, reason: "superseded" };
    }
    if (
      mutationLeaseId === undefined &&
      hasActiveMutationLease(current, syncedAt)
    ) {
      return { ok: false, reason: "busy" };
    }
    return {
      ok: false,
      reason: "throttled",
      retryAfterMs: await refreshRetryAfterMs(syncedAt),
    };
  }

  try {
    const snapshot = await (
      await getPinballMapClient()
    ).fetchLocation(trackedLocationId);
    const stored = await recordSyncSuccess(
      trackedLocationId,
      configurationGeneration,
      snapshot,
      syncedAt,
      opts?.updatedBy
    );
    if (!stored) return { ok: false, reason: "superseded" };
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = errorMessage(err, "Unknown sync error");
    // Note: no `lastSyncedAt` here — a failed attempt must not advance the
    // last-successful-sync clock. `updatedAt` still records that we wrote.
    const stored = await recordSyncFailure(
      trackedLocationId,
      configurationGeneration,
      message,
      syncedAt,
      opts?.updatedBy
    );
    if (!stored) return { ok: false, reason: "superseded" };
    return { ok: false, reason: "error", error: message };
  }
}
