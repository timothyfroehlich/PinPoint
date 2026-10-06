import "server-only";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { errorMessage } from "~/lib/errors";
import { pinballmapLocationChecks, pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import { clearResolvedAbandonments } from "./abandoned-listings";
import { markCommentsFromOtherLocations } from "./previous-listing";
import { PBM_LOCATION_CHECK_TTL_MS } from "./config";
import {
  PINBALLMAP_STATE_ID,
  availableMutationLease,
  hasActiveMutationLease,
} from "./mutation-lease";
import { refreshRetryAfterMs, stampSyncAttempt } from "./refresh-allowance";
import { getPinballMapState } from "./runtime-state";
import { PinballMapReadError } from "./types";
import type { LocationSnapshot } from "./types";

/**
 * Changing the tracked location (spec 10.9, 10.13, 10.14): check a candidate
 * (one human refresh token, nothing configured changes), commit the checked
 * candidate without another PBM request, or clear the location. Each commit or
 * clear bumps `configurationGeneration` and requires the mutation lease to be
 * free, so an outbound lineup write and a configuration change never overlap.
 */

export interface CheckedLocationPreview {
  checkId: string;
  locationId: number;
  name: string;
  city: string | null;
  state: string | null;
  machineCount: number;
  checkedAt: Date;
  expiresAt: Date;
}

export type CheckTrackedLocationResult =
  | { ok: true; candidate: CheckedLocationPreview }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "concurrent_change" }
  | { ok: false; reason: "fetch_failed"; error: string }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

export type CommitCheckedLocationResult =
  | { ok: true }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "unauthorized" }
  | { ok: false; reason: "expired" }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "concurrent_change" };

export type ClearTrackedLocationResult =
  | { ok: true }
  | { ok: false; reason: "busy" }
  | { ok: false; reason: "concurrent_change" };

async function deleteExpiredLocationChecks(): Promise<void> {
  await db
    .delete(pinballmapLocationChecks)
    .where(lte(pinballmapLocationChecks.expiresAt, sql`now()`));
}

/**
 * Spend one human refresh token and fetch a candidate without changing the
 * configured location or its health. The snapshot stays server-side behind an
 * opaque, admin-bound id until Save commits it (spec 10.9, 10.13, 10.14).
 */
export async function checkTrackedLocation(
  locationId: number,
  checkedBy: string
): Promise<CheckTrackedLocationResult> {
  if (!Number.isSafeInteger(locationId) || locationId <= 0) {
    return { ok: false, reason: "invalid" };
  }

  const state = await getPinballMapState();
  const expectedLocationId = state?.locationId ?? null;
  const expectedGeneration = state?.configurationGeneration ?? 0;
  const attemptedAt = new Date();
  const claimed = await stampSyncAttempt(
    expectedLocationId,
    expectedGeneration,
    attemptedAt,
    true,
    false,
    undefined
  );

  if (!claimed) {
    const current = await getPinballMapState();
    if (
      (current?.locationId ?? null) !== expectedLocationId ||
      (current?.configurationGeneration ?? 0) !== expectedGeneration
    ) {
      return { ok: false, reason: "concurrent_change" };
    }
    if (hasActiveMutationLease(current, attemptedAt)) {
      return { ok: false, reason: "busy" };
    }
    return {
      ok: false,
      reason: "throttled",
      retryAfterMs: await refreshRetryAfterMs(attemptedAt),
    };
  }

  const baseline = await getPinballMapState();
  if (
    baseline === null ||
    (baseline.locationId ?? null) !== expectedLocationId ||
    baseline.configurationGeneration !== expectedGeneration
  ) {
    return { ok: false, reason: "concurrent_change" };
  }
  if (hasActiveMutationLease(baseline, attemptedAt)) {
    return { ok: false, reason: "busy" };
  }

  let snapshot: LocationSnapshot;
  try {
    snapshot = await (await getPinballMapClient()).fetchLocation(locationId);
  } catch (error) {
    if (error instanceof PinballMapReadError && error.reason === "not_found") {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: false,
      reason: "fetch_failed",
      error: errorMessage(error, "Unknown check error"),
    };
  }

  if (snapshot.locationId !== locationId) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: "Pinball Map returned a different location than requested.",
    };
  }

  const checkedAt = new Date();
  const current = await getPinballMapState();
  if (
    (current?.locationId ?? null) !== expectedLocationId ||
    (current?.configurationGeneration ?? 0) !== expectedGeneration ||
    current?.snapshotRevision !== baseline.snapshotRevision
  ) {
    return { ok: false, reason: "concurrent_change" };
  }
  if (hasActiveMutationLease(current, checkedAt)) {
    return { ok: false, reason: "busy" };
  }

  await deleteExpiredLocationChecks();
  const [stored] = await db
    .insert(pinballmapLocationChecks)
    .values({
      locationId,
      expectedLocationId,
      expectedGeneration,
      expectedSnapshotRevision: baseline.snapshotRevision,
      snapshotJson: snapshot,
      checkedBy,
      checkedAt: sql`now()`,
      expiresAt: sql`now() + (${PBM_LOCATION_CHECK_TTL_MS} * interval '1 millisecond')`,
    })
    .returning({
      id: pinballmapLocationChecks.id,
      checkedAt: pinballmapLocationChecks.checkedAt,
      expiresAt: pinballmapLocationChecks.expiresAt,
    });
  if (!stored) {
    return {
      ok: false,
      reason: "fetch_failed",
      error: "PinPoint could not retain the checked location.",
    };
  }

  return {
    ok: true,
    candidate: {
      checkId: stored.id,
      locationId,
      name: snapshot.name,
      city: snapshot.city ?? null,
      state: snapshot.state ?? null,
      machineCount: snapshot.machineCount,
      checkedAt: stored.checkedAt,
      expiresAt: stored.expiresAt,
    },
  };
}

/** Commit one unexpired, admin-bound candidate without another PBM request. */
export async function commitCheckedTrackedLocation(
  checkId: string,
  checkedBy: string,
  updatedBy?: string
): Promise<CommitCheckedLocationResult> {
  const [selected] = await db
    .select({
      candidate: pinballmapLocationChecks,
      isExpired: sql<boolean>`${pinballmapLocationChecks.expiresAt} <= now()`,
    })
    .from(pinballmapLocationChecks)
    .where(eq(pinballmapLocationChecks.id, checkId))
    .limit(1);
  if (!selected) return { ok: false, reason: "not_found" };
  const { candidate } = selected;
  if (candidate.checkedBy !== checkedBy) {
    return { ok: false, reason: "unauthorized" };
  }

  if (selected.isExpired) {
    await db
      .delete(pinballmapLocationChecks)
      .where(eq(pinballmapLocationChecks.id, checkId));
    return { ok: false, reason: "expired" };
  }

  return db.transaction(async (tx) => {
    const commitAt = new Date();
    const [fresh] = await tx
      .select({
        candidate: pinballmapLocationChecks,
        isExpired: sql<boolean>`${pinballmapLocationChecks.expiresAt} <= now()`,
      })
      .from(pinballmapLocationChecks)
      .where(
        and(
          eq(pinballmapLocationChecks.id, checkId),
          eq(pinballmapLocationChecks.checkedBy, checkedBy)
        )
      )
      .limit(1);
    if (!fresh) {
      return { ok: false, reason: "not_found" };
    }
    if (fresh.isExpired) {
      await tx
        .delete(pinballmapLocationChecks)
        .where(eq(pinballmapLocationChecks.id, checkId));
      return { ok: false, reason: "expired" };
    }
    const freshCandidate = fresh.candidate;
    const locationGuard =
      freshCandidate.expectedLocationId === null
        ? isNull(pinballmapState.locationId)
        : eq(pinballmapState.locationId, freshCandidate.expectedLocationId);
    const actor = updatedBy === undefined ? {} : { updatedBy };
    const committed = await tx
      .update(pinballmapState)
      .set({
        locationId: freshCandidate.locationId,
        configurationGeneration: sql`${pinballmapState.configurationGeneration} + 1`,
        snapshotJson: freshCandidate.snapshotJson,
        snapshotRevision: sql`${pinballmapState.snapshotRevision} + 1`,
        lastSyncedAt: freshCandidate.checkedAt,
        lastSyncAttemptAt: freshCandidate.checkedAt,
        lastSyncStatus: "ok",
        lastSyncError: null,
        mutationLeaseId: null,
        mutationLeaseExpiresAt: null,
        updatedAt: commitAt,
        ...actor,
      })
      .where(
        and(
          eq(pinballmapState.id, PINBALLMAP_STATE_ID),
          locationGuard,
          eq(
            pinballmapState.configurationGeneration,
            freshCandidate.expectedGeneration
          ),
          eq(
            pinballmapState.snapshotRevision,
            freshCandidate.expectedSnapshotRevision
          ),
          availableMutationLease(commitAt)
        )
      )
      .returning({ id: pinballmapState.id });
    if (committed.length === 0) {
      const [current] = await tx
        .select({
          locationId: pinballmapState.locationId,
          configurationGeneration: pinballmapState.configurationGeneration,
          mutationLeaseId: pinballmapState.mutationLeaseId,
          mutationLeaseExpiresAt: pinballmapState.mutationLeaseExpiresAt,
        })
        .from(pinballmapState)
        .where(eq(pinballmapState.id, PINBALLMAP_STATE_ID))
        .limit(1);
      if (
        (current?.locationId ?? null) === freshCandidate.expectedLocationId &&
        (current?.configurationGeneration ?? 0) ===
          freshCandidate.expectedGeneration &&
        hasActiveMutationLease(current ?? null, commitAt)
      ) {
        return { ok: false, reason: "busy" };
      }
      await tx
        .delete(pinballmapLocationChecks)
        .where(eq(pinballmapLocationChecks.id, checkId));
      return { ok: false, reason: "concurrent_change" };
    }
    await clearResolvedAbandonments(
      freshCandidate.snapshotJson,
      freshCandidate.locationId,
      tx
    );
    await markCommentsFromOtherLocations(
      tx,
      freshCandidate.locationId,
      commitAt
    );
    await tx
      .delete(pinballmapLocationChecks)
      .where(eq(pinballmapLocationChecks.id, checkId));
    return { ok: true };
  });
}

/** Clear only the configured location under the same generation/lease guard. */
export async function clearTrackedLocation(
  expectedLocationId: number,
  expectedGeneration: number,
  updatedBy?: string
): Promise<ClearTrackedLocationResult> {
  const state = await getPinballMapState();
  const clearAt = new Date();
  if (
    state?.locationId === expectedLocationId &&
    hasActiveMutationLease(state, clearAt)
  ) {
    return { ok: false, reason: "busy" };
  }
  if (
    state?.locationId !== expectedLocationId ||
    state.configurationGeneration !== expectedGeneration
  ) {
    return { ok: false, reason: "concurrent_change" };
  }

  const actor = updatedBy === undefined ? {} : { updatedBy };
  const cleared = await db
    .update(pinballmapState)
    .set({
      locationId: null,
      configurationGeneration: sql`${pinballmapState.configurationGeneration} + 1`,
      mutationLeaseId: null,
      mutationLeaseExpiresAt: null,
      updatedAt: clearAt,
      ...actor,
    })
    .where(
      and(
        eq(pinballmapState.id, PINBALLMAP_STATE_ID),
        eq(pinballmapState.locationId, expectedLocationId),
        eq(pinballmapState.configurationGeneration, expectedGeneration),
        availableMutationLease(clearAt)
      )
    )
    .returning({ id: pinballmapState.id });
  if (cleared.length > 0) return { ok: true };

  const current = await getPinballMapState();
  if (
    current?.locationId === expectedLocationId &&
    current.configurationGeneration === expectedGeneration &&
    hasActiveMutationLease(current, clearAt)
  ) {
    return { ok: false, reason: "busy" };
  }
  return { ok: false, reason: "concurrent_change" };
}
