import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { PBM_REFRESH_BURST, PBM_REFRESH_REFILL_MS } from "./config";
import type { PinballmapRuntimeState } from "~/lib/types";

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
const MUTATION_LEASE_MS = 10 * 60 * 1000;

export interface PinballMapMutationLease {
  id: string;
  trackedLocationId: number | null;
  configurationGeneration: number;
}

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
      lastSyncedAt: pinballmapState.lastSyncedAt,
      lastSyncAttemptAt: pinballmapState.lastSyncAttemptAt,
      lastSyncStatus: pinballmapState.lastSyncStatus,
      lastSyncError: pinballmapState.lastSyncError,
      refreshTokens: pinballmapState.refreshTokens,
      refreshTokensAt: pinballmapState.refreshTokensAt,
      outboundEmail: pinballmapState.outboundEmail,
      outboundTokenVaultId: pinballmapState.outboundTokenVaultId,
      updatedAt: pinballmapState.updatedAt,
      updatedBy: pinballmapState.updatedBy,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, SINGLETON_ID))
    .limit(1);
  return row ?? null;
}

/** Materialize the singleton without naming deploy-order compatibility columns. */
async function ensureStateRow(): Promise<void> {
  await db.execute(sql`
    INSERT INTO "pinballmap_state" ("id")
    VALUES (${SINGLETON_ID})
    ON CONFLICT ("id") DO NOTHING
  `);
}

function availableMutationLease(now: Date): ReturnType<typeof or> {
  return or(
    isNull(pinballmapState.mutationLeaseId),
    lt(pinballmapState.mutationLeaseExpiresAt, now)
  );
}

/**
 * Reserve the configured location for one outbound addition.
 *
 * A configuration save claims the same singleton lease before its validating
 * fetch, so exactly one of the save and add can own the location. The lease is
 * deliberately time-bounded: a killed server action cannot strand integration
 * configuration forever.
 */
export async function claimPinballMapMutationLease(
  trackedLocationId: number | null,
  configurationGeneration: number
): Promise<PinballMapMutationLease | null> {
  const now = new Date();
  const id = randomUUID();
  const locationGuard =
    trackedLocationId === null
      ? isNull(pinballmapState.locationId)
      : eq(pinballmapState.locationId, trackedLocationId);
  const [claimed] = await db
    .update(pinballmapState)
    .set({
      mutationLeaseId: id,
      mutationLeaseExpiresAt: new Date(now.getTime() + MUTATION_LEASE_MS),
    })
    .where(
      and(
        eq(pinballmapState.id, SINGLETON_ID),
        locationGuard,
        eq(pinballmapState.configurationGeneration, configurationGeneration),
        availableMutationLease(now)
      )
    )
    .returning({ id: pinballmapState.id });
  return claimed ? { id, trackedLocationId, configurationGeneration } : null;
}

export async function releasePinballMapMutationLease(
  leaseId: string
): Promise<void> {
  await db
    .update(pinballmapState)
    .set({ mutationLeaseId: null, mutationLeaseExpiresAt: null })
    .where(
      and(
        eq(pinballmapState.id, SINGLETON_ID),
        eq(pinballmapState.mutationLeaseId, leaseId)
      )
    );
}

async function claimConfigurationLease(
  expectedLocationId: number | null,
  expectedGeneration: number
): Promise<{ id: string; configurationGeneration: number } | null> {
  await ensureStateRow();
  const now = new Date();
  const id = randomUUID();
  const locationGuard =
    expectedLocationId === null
      ? isNull(pinballmapState.locationId)
      : eq(pinballmapState.locationId, expectedLocationId);
  const [claimed] = await db
    .update(pinballmapState)
    .set({
      configurationGeneration: sql`${pinballmapState.configurationGeneration} + 1`,
      mutationLeaseId: id,
      mutationLeaseExpiresAt: new Date(now.getTime() + MUTATION_LEASE_MS),
    })
    .where(
      and(
        eq(pinballmapState.id, SINGLETON_ID),
        locationGuard,
        eq(pinballmapState.configurationGeneration, expectedGeneration),
        availableMutationLease(now)
      )
    )
    .returning({
      configurationGeneration: pinballmapState.configurationGeneration,
    });
  return claimed
    ? { id, configurationGeneration: claimed.configurationGeneration }
    : null;
}

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

export type ValidationSyncResult =
  | {
      ok: true;
      machineCount: number;
      syncedAt: Date;
      snapshot: NonNullable<PinballmapRuntimeState["snapshotJson"]>;
    }
  | SyncFailure;

interface SyncOptions {
  updatedBy?: string;
  trigger?: SyncTrigger;
  mutationLeaseId?: string;
}

interface ValidationSyncOptions {
  updatedBy?: string;
  validation: {
    locationId: number;
    expectedLocationId: number | null;
    mutationLeaseId: string;
  };
}

/**
 * What is left of the shared refresh allowance (spec 3.2), so the header's
 * Refresh button can disable itself with a countdown instead of letting someone
 * click into a refusal.
 *
 * Advisory only. It is read outside the claim, so a concurrent refresh can spend
 * the last token between this call and the click; the claim in
 * `stampSyncAttempt` stays the authority.
 */
export interface RefreshAllowance {
  remaining: number;
  /** When the next token lands. Null when the bucket is already full. */
  nextRefillAt: Date | null;
}

/**
 * Lazily refill the bucket in JS, mirroring the SQL in `stampSyncAttempt`.
 *
 * Nothing is written: tokens accrue with the passage of time, so a read can
 * compute the current balance from the last claim without touching the row.
 */
function currentAllowance(
  tokens: number,
  tokensAt: Date,
  now: Date
): RefreshAllowance {
  const elapsed = now.getTime() - tokensAt.getTime();
  const periods = Math.max(0, Math.floor(elapsed / PBM_REFRESH_REFILL_MS));
  const remaining = Math.min(PBM_REFRESH_BURST, tokens + periods);
  if (remaining >= PBM_REFRESH_BURST) return { remaining, nextRefillAt: null };
  // Time already served toward the next token is kept, which is the whole point
  // of advancing `refreshTokensAt` by whole periods rather than to `now()`.
  const nextAt = tokensAt.getTime() + (periods + 1) * PBM_REFRESH_REFILL_MS;
  return { remaining, nextRefillAt: new Date(nextAt) };
}

/** Read the shared refresh allowance. A missing row means an untouched bucket. */
export async function getRefreshAllowance(
  now: Date = new Date()
): Promise<RefreshAllowance> {
  const state = await getPinballMapState();
  if (!state) return { remaining: PBM_REFRESH_BURST, nextRefillAt: null };
  return currentAllowance(state.refreshTokens, state.refreshTokensAt, now);
}

/**
 * These raw upserts intentionally name only the post-contract columns. Drizzle
 * inserts every schema-declared column (using DEFAULT for omitted values), which
 * would still mention `enabled` after the follow-up migration drops it while
 * this deployment is serving. The error path omits the last good snapshot and
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
      "last_synced_at",
      "last_sync_status",
      "last_sync_error",
      "updated_at",
      "updated_by"
    )
    VALUES (
      ${SINGLETON_ID},
      ${locationId},
      ${JSON.stringify(snapshot)}::text::jsonb,
      ${syncedAt.toISOString()}::timestamptz,
      'ok',
      NULL,
      ${syncedAt.toISOString()}::timestamptz,
      ${updatedBy ?? null}::uuid
    )
    ON CONFLICT ("id") DO UPDATE SET
      "location_id" = EXCLUDED."location_id",
      "snapshot_json" = EXCLUDED."snapshot_json",
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
      ${SINGLETON_ID},
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
 * Whole refill periods elapsed since the bucket last moved, computed in SQL.
 *
 * `now()` rather than the caller's `Date`: a bare Date interpolated into `sql`
 * is bound with NO type information — Drizzle applies a column's mapper only
 * where it knows the column, which covers `values`/`set` but not an operand
 * inside a raw fragment, and postgres.js then throws `The "string" argument
 * must be of type string or an instance of Buffer` before the statement is
 * sent. That threw on every manual sync from 2026-07-21 (PP-hbi0, #1712);
 * keeping the clock inside the database avoids the binding entirely, and a few
 * milliseconds of skew against the caller's timestamp cannot matter to a
 * three-minute refill.
 */
const ELAPSED_PERIODS = sql`floor(extract(epoch from (now() - ${pinballmapState.refreshTokensAt})) * 1000 / ${PBM_REFRESH_REFILL_MS})`;

/** Tokens available right now: what is banked, plus what time has refilled. */
const AVAILABLE_TOKENS = sql`least(${PBM_REFRESH_BURST}, ${pinballmapState.refreshTokens} + ${ELAPSED_PERIODS})`;

/** Raw RETURNING differs between postgres-js (array) and PGlite ({ rows }). */
function hasReturnedRow(result: unknown): boolean {
  if (Array.isArray(result)) return result.length > 0;
  if (typeof result !== "object" || result === null || !("rows" in result)) {
    return false;
  }
  return Array.isArray(result.rows) && result.rows.length > 0;
}

/**
 * Stamp the attempt and claim a refresh token, atomically.
 *
 * This is the single throttle chokepoint (PP-hbi0, spec 3.2). One statement does
 * the read-check-refill-decrement, so the row lock on the singleton serializes
 * concurrent double-clicks and exactly one wins — a JS read-then-write could
 * not, and neither could a completion timestamp like `lastSyncedAt`, which only
 * advances after the fetch returns.
 *
 * - `guarded === false` (cron): unconditional stamp, no token spent. The hourly
 *   refresh is separately sanctioned, and charging it to the human allowance
 *   would let the cron lock people out of their own button.
 * - `guarded === true` (manual): the `DO UPDATE` fires only while a token is
 *   available; an empty `RETURNING` means throttled. The stamp is on the last
 *   ATTEMPT, not the last success, so a failed fetch (429/500) still spends its
 *   token rather than fail-opening into a retry loop (CORE-PBM-001).
 *
 * `refreshTokensAt` advances by whole refill periods rather than to `now()`, so
 * the fraction of a period already served is not thrown away on every claim —
 * otherwise a steady clicker could hold the bucket empty indefinitely.
 */
async function stampSyncAttempt(
  expectedLocationId: number | null,
  expectedGeneration: number,
  attemptAt: Date,
  guarded: boolean,
  recordHealth: boolean,
  expectedLeaseId: string | undefined
): Promise<boolean> {
  const locationGuard =
    expectedLocationId === null
      ? isNull(pinballmapState.locationId)
      : eq(pinballmapState.locationId, expectedLocationId);
  const leaseGuard =
    expectedLeaseId === undefined
      ? availableMutationLease(attemptAt)
      : eq(pinballmapState.mutationLeaseId, expectedLeaseId);
  const values = {
    id: SINGLETON_ID,
    locationId: expectedLocationId,
    lastSyncAttemptAt: attemptAt,
    updatedAt: attemptAt,
  };

  if (!guarded) {
    const stamped = await db.execute(sql`
      INSERT INTO "pinballmap_state" (
        "id",
        "location_id",
        "last_sync_attempt_at",
        "updated_at"
      )
      VALUES (
        ${values.id},
        ${values.locationId},
        ${attemptAt.toISOString()}::timestamptz,
        ${attemptAt.toISOString()}::timestamptz
      )
      ON CONFLICT ("id") DO UPDATE SET
        "last_sync_attempt_at" = EXCLUDED."last_sync_attempt_at",
        "updated_at" = EXCLUDED."updated_at"
      WHERE ${locationGuard}
        AND "pinballmap_state"."configuration_generation" = ${expectedGeneration}
        AND ${leaseGuard}
      RETURNING "id"
    `);
    return hasReturnedRow(stamped);
  }

  if (!recordHealth) {
    // Candidate validation spends the shared traffic allowance but is not an
    // attempt to refresh the CURRENT location. Leave its health untouched; the
    // successful configuration commit writes coherent health for the candidate.
    const claimed = await db.execute(sql`
      INSERT INTO "pinballmap_state" (
        "id",
        "location_id",
        "refresh_tokens",
        "refresh_tokens_at"
      )
      VALUES (
        ${values.id},
        ${values.locationId},
        ${PBM_REFRESH_BURST - 1},
        ${attemptAt.toISOString()}::timestamptz
      )
      ON CONFLICT ("id") DO UPDATE SET
        "refresh_tokens" = ${AVAILABLE_TOKENS} - 1,
        "refresh_tokens_at" = ${pinballmapState.refreshTokensAt}
          + (interval '1 millisecond' * ${PBM_REFRESH_REFILL_MS} * ${ELAPSED_PERIODS})
      WHERE ${AVAILABLE_TOKENS} >= 1
        AND ${locationGuard}
        AND "pinballmap_state"."configuration_generation" = ${expectedGeneration}
        AND ${leaseGuard}
      RETURNING "id"
    `);
    return hasReturnedRow(claimed);
  }

  // A first-ever manual refresh creates the row with one token already spent.
  const claimed = await db.execute(sql`
    INSERT INTO "pinballmap_state" (
      "id",
      "location_id",
      "last_sync_attempt_at",
      "updated_at",
      "refresh_tokens",
      "refresh_tokens_at"
    )
    VALUES (
      ${values.id},
      ${values.locationId},
      ${attemptAt.toISOString()}::timestamptz,
      ${attemptAt.toISOString()}::timestamptz,
      ${PBM_REFRESH_BURST - 1},
      ${attemptAt.toISOString()}::timestamptz
    )
    ON CONFLICT ("id") DO UPDATE SET
      "last_sync_attempt_at" = EXCLUDED."last_sync_attempt_at",
      "updated_at" = EXCLUDED."updated_at",
      "refresh_tokens" = ${AVAILABLE_TOKENS} - 1,
      "refresh_tokens_at" = ${pinballmapState.refreshTokensAt}
        + (interval '1 millisecond' * ${PBM_REFRESH_REFILL_MS} * ${ELAPSED_PERIODS})
    WHERE ${AVAILABLE_TOKENS} >= 1
      AND ${locationGuard}
      AND "pinballmap_state"."configuration_generation" = ${expectedGeneration}
      AND ${leaseGuard}
    RETURNING "id"
  `);
  return hasReturnedRow(claimed);
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
  opts: ValidationSyncOptions
): Promise<ValidationSyncResult>;
export async function syncLocationSnapshot(
  opts?: SyncOptions
): Promise<SyncResult>;
export async function syncLocationSnapshot(
  opts?: SyncOptions | ValidationSyncOptions
): Promise<SyncResult | ValidationSyncResult> {
  const validation = opts && "validation" in opts ? opts.validation : null;
  const trigger =
    validation === null && opts && !("validation" in opts)
      ? (opts.trigger ?? "manual")
      : "manual";
  const mutationLeaseId =
    validation?.mutationLeaseId ??
    (validation === null && opts && !("validation" in opts)
      ? opts.mutationLeaseId
      : undefined);
  const state = await getPinballMapState();
  const trackedLocationId = state?.locationId ?? null;
  const configurationGeneration = state?.configurationGeneration ?? 0;
  const expectedLocationId =
    validation?.expectedLocationId ?? trackedLocationId;
  const locationId = validation?.locationId ?? trackedLocationId;
  if (trackedLocationId !== expectedLocationId) {
    return { ok: false, reason: "superseded" };
  }
  if (locationId === null) {
    return { ok: false, reason: "not_configured" };
  }
  const syncedAt = new Date();

  // Chokepoint: stamp the attempt before the fetch. Manual spends a token
  // (TOCTOU-safe); cron records unconditionally.
  const claimed = await stampSyncAttempt(
    expectedLocationId,
    configurationGeneration,
    syncedAt,
    trigger === "manual",
    validation === null,
    mutationLeaseId
  );
  if (!claimed) {
    const current = await getPinballMapState();
    if (
      (current?.locationId ?? null) !== expectedLocationId ||
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
      current?.mutationLeaseId !== null &&
      current?.mutationLeaseId !== undefined &&
      current.mutationLeaseExpiresAt !== null &&
      current.mutationLeaseExpiresAt.getTime() > syncedAt.getTime()
    ) {
      return { ok: false, reason: "busy" };
    }
    // Re-read rather than reuse the row loaded above: the claim we just lost
    // was won by somebody, so the bucket moved and the pre-claim copy would
    // report a refill time that has already passed.
    const { nextRefillAt } = await getRefreshAllowance(syncedAt);
    return {
      ok: false,
      reason: "throttled",
      retryAfterMs: Math.max(
        0,
        (nextRefillAt?.getTime() ??
          syncedAt.getTime() + PBM_REFRESH_REFILL_MS) - syncedAt.getTime()
      ),
    };
  }

  try {
    const snapshot = await (
      await getPinballMapClient()
    ).fetchLocation(locationId);
    if (validation !== null) {
      return {
        ok: true,
        machineCount: snapshot.machineCount,
        syncedAt,
        snapshot,
      };
    }
    const stored = await recordSyncSuccess(
      locationId,
      configurationGeneration,
      snapshot,
      syncedAt,
      opts?.updatedBy
    );
    if (!stored) return { ok: false, reason: "superseded" };
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    if (validation !== null) {
      return { ok: false, reason: "error", error: message };
    }
    // Note: no `lastSyncedAt` here — a failed attempt must not advance the
    // last-successful-sync clock. `updatedAt` still records that we wrote.
    const stored = await recordSyncFailure(
      locationId,
      configurationGeneration,
      message,
      syncedAt,
      opts?.updatedBy
    );
    if (!stored) return { ok: false, reason: "superseded" };
    return { ok: false, reason: "error", error: message };
  }
}

export type SetTrackedLocationResult =
  | { ok: true }
  | { ok: false; reason: "concurrent_change" }
  | { ok: false; reason: "error"; error: string }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

/**
 * Validate and atomically store the tracked Pinball Map location (spec 10.7–10.14).
 *
 * A non-empty save validates through `syncLocationSnapshot` before opening the
 * transaction, so the external read obeys CORE-ARCH-011 and spends from the
 * shared manual-refresh allowance. The transaction then replaces the location,
 * snapshot, and health together. Clearing writes only the nullable location;
 * the retained snapshot, health, links, intent, comments, and abandonments stay
 * dormant and reversible.
 */
export async function setTrackedLocation(
  locationId: number | null,
  updatedBy?: string
): Promise<SetTrackedLocationResult> {
  const state = await getPinballMapState();
  const previousLocationId = state?.locationId ?? null;
  const previousGeneration = state?.configurationGeneration ?? 0;
  const previousLocationGuard =
    previousLocationId === null
      ? isNull(pinballmapState.locationId)
      : eq(pinballmapState.locationId, previousLocationId);
  const actor = updatedBy === undefined ? {} : { updatedBy };

  if (locationId === null && !state) return { ok: true };

  // Claim before validation so an Add cannot begin halfway through a switch,
  // and advance the generation immediately so every older sync is superseded
  // even for A -> B -> A or a same-location re-save (spec 10.9, 10.14).
  const lease = await claimConfigurationLease(
    previousLocationId,
    previousGeneration
  );
  if (!lease) return { ok: false, reason: "concurrent_change" };

  try {
    if (locationId === null) {
      const cleared = await db
        .update(pinballmapState)
        .set({
          locationId: null,
          mutationLeaseId: null,
          mutationLeaseExpiresAt: null,
          updatedAt: new Date(),
          ...actor,
        })
        .where(
          and(
            eq(pinballmapState.id, SINGLETON_ID),
            previousLocationGuard,
            eq(pinballmapState.mutationLeaseId, lease.id),
            eq(
              pinballmapState.configurationGeneration,
              lease.configurationGeneration
            )
          )
        )
        .returning({ id: pinballmapState.id });
      return cleared.length > 0
        ? { ok: true }
        : { ok: false, reason: "concurrent_change" };
    }

    const validated = await syncLocationSnapshot({
      validation: {
        locationId,
        expectedLocationId: previousLocationId,
        mutationLeaseId: lease.id,
      },
      ...(updatedBy === undefined ? {} : { updatedBy }),
    });
    if (!validated.ok) {
      if (validated.reason === "throttled") return validated;
      if (validated.reason === "superseded") {
        return { ok: false, reason: "concurrent_change" };
      }
      if (validated.reason === "busy") {
        return { ok: false, reason: "concurrent_change" };
      }
      return {
        ok: false,
        reason: "error",
        error:
          validated.reason === "error"
            ? validated.error
            : "Pinball Map is not configured.",
      };
    }

    const committed = await db
      .update(pinballmapState)
      .set({
        locationId,
        snapshotJson: validated.snapshot,
        lastSyncedAt: validated.syncedAt,
        lastSyncAttemptAt: validated.syncedAt,
        lastSyncStatus: "ok",
        lastSyncError: null,
        mutationLeaseId: null,
        mutationLeaseExpiresAt: null,
        updatedAt: validated.syncedAt,
        ...actor,
      })
      .where(
        and(
          eq(pinballmapState.id, SINGLETON_ID),
          previousLocationGuard,
          eq(pinballmapState.mutationLeaseId, lease.id),
          eq(
            pinballmapState.configurationGeneration,
            lease.configurationGeneration
          )
        )
      )
      .returning({ id: pinballmapState.id });
    return committed.length > 0
      ? { ok: true }
      : { ok: false, reason: "concurrent_change" };
  } finally {
    await releasePinballMapMutationLease(lease.id);
  }
}
