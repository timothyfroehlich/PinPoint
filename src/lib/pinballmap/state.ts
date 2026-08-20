import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { getPinballMapClient } from "./client";
import {
  APC_LOCATION_ID,
  PBM_REFRESH_BURST,
  PBM_REFRESH_REFILL_MS,
} from "./config";
import type { NewPinballmapState, PinballmapState } from "~/lib/types/database";
import type { LocationSnapshot } from "./types";

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
 * Outcome of a sync attempt.
 *
 * `superseded` is the 6.6 guard firing: the fetch succeeded, but a location
 * change landed while it was in flight, so the snapshot was discarded rather
 * than stored under an id it does not describe. It is deliberately NOT `ok` —
 * the caller would otherwise report a machine count from a venue nobody is
 * tracking any more, and reconcile a lineup it never stored (CORE-ARCH-012).
 */
export type SyncResult =
  | { ok: true; machineCount: number; syncedAt: Date }
  | { ok: false; reason: "error"; error: string }
  | { ok: false; reason: "superseded" }
  | { ok: false; reason: "throttled"; retryAfterMs: number };

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
 * Upsert the singleton, writing the given health fields. `id` is fixed and the
 * differing fields (snapshot, health, actor) are passed by the caller, so the ok
 * and error paths can't drift. The `set` reuses the same fields, so a key omitted
 * by the caller (e.g. `snapshotJson`/`lastSyncedAt` on the error path) is left
 * untouched on an existing row rather than clobbered.
 */
async function upsertState(
  fields: Omit<NewPinballmapState, "id"> & { locationId: number },
  guardLocationId?: number
): Promise<boolean> {
  const written = await db
    .insert(pinballmapState)
    .values({ id: SINGLETON_ID, ...fields })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: fields,
      // Concurrency guard (spec 6.6). When a caller writes for a specific
      // location, the update fires only while the singleton STILL tracks that
      // location. A `changeLocation` that landed during a long PBM fetch has
      // already moved the id and stored the new lineup; letting this write land
      // would either revert the id or store an old-location snapshot under the
      // new one. The guard makes the stale write a no-op instead. Absent on the
      // first-ever insert, where there is no row to guard.
      ...(guardLocationId === undefined
        ? {}
        : { setWhere: eq(pinballmapState.locationId, guardLocationId) }),
    })
    .returning({ id: pinballmapState.id });
  // Whether the write actually landed. An empty `RETURNING` means the guard
  // rejected it, and the caller must not report a write that did not happen
  // (CORE-ARCH-012).
  return written.length > 0;
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

/**
 * Stamp the attempt and claim a refresh token, atomically.
 *
 * This is the single throttle chokepoint (PP-hbi0, spec 3.2). One statement does
 * the read-check-refill-decrement, so the row lock on the singleton serializes
 * concurrent double-clicks and exactly one wins — a JS read-then-write could
 * not, and neither could a completion timestamp like `lastSyncedAt`, which only
 * advances after the fetch returns.
 *
 * All fetches share a single rate limit (spec 6.5). The `DO UPDATE` fires only
 * while a token is available; an empty `RETURNING` means throttled. The stamp is
 * on the last ATTEMPT, not the last success, so a failed fetch (429/500) still
 * spends its token rather than fail-opening into a retry loop (CORE-PBM-001).
 *
 * `refreshTokensAt` advances by whole refill periods rather than to `now()`, so
 * the fraction of a period already served is not thrown away on every claim —
 * otherwise a steady clicker could hold the bucket empty indefinitely.
 */
async function stampSyncAttempt(
  locationId: number,
  attemptAt: Date
): Promise<boolean> {
  const claimed = await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId,
      lastSyncAttemptAt: attemptAt,
      updatedAt: attemptAt,
      refreshTokens: PBM_REFRESH_BURST - 1,
      refreshTokensAt: attemptAt,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: {
        lastSyncAttemptAt: attemptAt,
        updatedAt: attemptAt,
        refreshTokens: sql`${AVAILABLE_TOKENS} - 1`,
        refreshTokensAt: sql`${pinballmapState.refreshTokensAt} + (interval '1 millisecond' * ${PBM_REFRESH_REFILL_MS} * ${ELAPSED_PERIODS})`,
      },
      setWhere: sql`${AVAILABLE_TOKENS} >= 1`,
    })
    .returning({ id: pinballmapState.id });
  return claimed.length > 0;
}

/**
 * Fetch the configured location's snapshot from PBM and store it whole, updating
 * sync health. Never throws on a PBM/network failure: it records the error on the
 * singleton and returns `{ ok: false, reason: "error" }` so callers (cron, "Sync
 * now") can surface it without a 500.
 *
 * Throttle chokepoint (PP-hbi0, spec 3.2): every call spends a token from the
 * shared burst allowance and returns `{ ok: false, reason: "throttled" }` when
 * the bucket is empty. One rate limit, no free path (spec 6.5).
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

  const claimed = await stampSyncAttempt(locationId, syncedAt);
  if (!claimed) {
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
    const stored = await upsertState(
      {
        locationId,
        snapshotJson: snapshot,
        lastSyncedAt: syncedAt,
        lastSyncStatus: "ok",
        lastSyncError: null,
        updatedAt: syncedAt,
        ...actor,
      },
      // Only persist if the singleton still tracks the location we fetched for;
      // a concurrent location change supersedes this snapshot (spec 6.6).
      locationId
    );
    // The guard rejected the write, so nothing about this fetch is stored.
    // Reporting `ok` here would hand the caller a machine count from the OLD
    // venue while the row shows the new one, and send `reconcileAfterSync` at a
    // lineup this call never wrote (CORE-ARCH-012).
    if (!stored) return { ok: false, reason: "superseded" };
    return { ok: true, machineCount: snapshot.machineCount, syncedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    // Note: no `lastSyncedAt` here — a failed attempt must not advance the
    // last-successful-sync clock. `updatedAt` still records that we wrote.
    // Guarded too (spec 6.6): a failed sync for the old location must not write
    // its error health — or its old id — over a location change that landed
    // during the fetch.
    await upsertState(
      {
        locationId,
        lastSyncStatus: "error",
        lastSyncError: message,
        updatedAt: syncedAt,
        ...actor,
      },
      locationId
    );
    return { ok: false, reason: "error", error: message };
  }
}

/** Outcome of a location change. */
export type ChangeLocationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unchanged" | "fetch_failed" | "concurrent_change" | "throttled";
      retryAfterMs?: number;
    };

/**
 * Re-point the integration at a different Pinball Map location (spec 6).
 *
 * Validate-before-commit (spec 6.2, CORE-ARCH-011): the new location is fetched
 * from Pinball Map FIRST, outside any transaction. A successful fetch is what
 * makes the id valid; a failed fetch — unknown id, network/auth error, or a
 * broken payload (machines reported but none parsed) — aborts with nothing
 * changed and the old location still tracked. A legitimately empty venue (zero
 * machines) is valid and proceeds. The commit is then a single guarded write
 * that stores the new id, replaces the snapshot, and sets sync health.
 *
 * Guarded on the OLD id (spec 6.6): if a concurrent change or in-flight sync
 * moved the id between the read and the write, the commit no-ops and the caller
 * hears `concurrent_change` rather than clobbering the other writer.
 *
 * Deliberately does NOT touch abandoned-listing records (spec 6.4 — they are
 * kept, location-scoped). The validating fetch spends a token from the shared
 * rate limit like every other Pinball Map call (spec 6.5).
 *
 * Disabled integration (spec 6.7): the id is changed, no fetch is made, and the
 * stored snapshot and health are cleared — a snapshot from the old venue is not
 * valid for the new one. The next enable's refresh (5.2) fills them in.
 */
export async function changeLocation(args: {
  newLocationId: number;
  updatedBy?: string;
  /**
   * Validate against Pinball Map even though the integration is currently
   * disabled. Set when the caller enables and re-points in the same save: the
   * end state is enabled, so taking the 6.7 no-fetch shortcut below would
   * commit an unvalidated id and leave the previous venue's lineup stored
   * under it.
   */
  validateWhileDisabled?: boolean;
}): Promise<ChangeLocationResult> {
  const { newLocationId } = args;
  const state = await getPinballMapState();
  const oldId = state?.locationId ?? APC_LOCATION_ID;
  if (newLocationId === oldId) return { ok: false, reason: "unchanged" };

  const now = new Date();
  const actor = args.updatedBy ? { updatedBy: args.updatedBy } : {};

  // Disabled (or never configured): move the id and clear the stale lineup, no
  // Pinball Map call (6.7 — see the docblock for why "left as-is" was wrong).
  // Upsert so a never-initialized singleton is created; the guard makes a
  // concurrent change a no-op on an existing row.
  if (!state?.enabled && !args.validateWhileDisabled) {
    // `lastSyncAttemptAt` is deliberately NOT cleared: it is the throttle's
    // clock (pinballmap spec 3.2), not observed location state, and 6.5 keeps
    // the allowance untouched across a location change.
    const cleared = {
      locationId: newLocationId,
      snapshotJson: null,
      lastSyncedAt: null,
      lastSyncStatus: "unknown" as const,
      lastSyncError: null,
      updatedAt: now,
      ...actor,
    };
    const committed = await db
      .insert(pinballmapState)
      .values({ id: SINGLETON_ID, ...cleared })
      .onConflictDoUpdate({
        target: pinballmapState.id,
        set: cleared,
        setWhere: eq(pinballmapState.locationId, oldId),
      })
      .returning({ id: pinballmapState.id });
    return committed.length > 0
      ? { ok: true }
      : { ok: false, reason: "concurrent_change" };
  }

  // Enabled: validate by fetching the new location BEFORE any write.
  // Spends a token from the shared rate limit (spec 6.5). Stamped against the
  // OLD id so a first-ever insert cannot persist an unvalidated new id.
  const claimed = await stampSyncAttempt(oldId, now);
  if (!claimed) {
    const { nextRefillAt } = await getRefreshAllowance(now);
    return {
      ok: false,
      reason: "throttled",
      retryAfterMs: Math.max(
        0,
        (nextRefillAt?.getTime() ?? now.getTime() + PBM_REFRESH_REFILL_MS) -
          now.getTime()
      ),
    };
  }

  let snapshot: LocationSnapshot;
  try {
    snapshot = await (await getPinballMapClient()).fetchLocation(newLocationId);
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
  // A broken payload — machines reported present but none parsed — is not a
  // valid empty venue; reject it rather than store an empty lineup that later
  // reads as "everything was removed" (mirrors clearResolvedAbandonments).
  if (snapshot.lmxes.length === 0 && snapshot.machineCount > 0) {
    return { ok: false, reason: "fetch_failed" };
  }

  // Commit the switch in one guarded statement (6.2, 6.6). Upsert rather than
  // update: `validateWhileDisabled` can reach here with no singleton row yet
  // (enabling a never-initialized integration while re-pointing it), and a bare
  // update would no-op and report that as a phantom concurrent change. The
  // `setWhere` guard keeps the same concurrency semantics when the row exists.
  const committed = await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: newLocationId,
      snapshotJson: snapshot,
      lastSyncedAt: now,
      lastSyncAttemptAt: now,
      lastSyncStatus: "ok",
      lastSyncError: null,
      updatedAt: now,
      ...actor,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: {
        locationId: newLocationId,
        snapshotJson: snapshot,
        lastSyncedAt: now,
        lastSyncAttemptAt: now,
        lastSyncStatus: "ok",
        lastSyncError: null,
        updatedAt: now,
        ...actor,
      },
      setWhere: eq(pinballmapState.locationId, oldId),
    })
    .returning({ id: pinballmapState.id });
  return committed.length > 0
    ? { ok: true }
    : { ok: false, reason: "concurrent_change" };
}

/**
 * Turn the integration on or off (spec 5).
 *
 * Enabling refreshes the stored snapshot so the lineup reflects the current
 * location immediately (5.2). The refresh spends a token from the shared rate
 * limit (spec 6.5). The `SyncResult` is returned so the caller can surface a
 * fetch failure or throttle; the enable itself has already been persisted.
 *
 * Disabling makes no Pinball Map call and clears nothing — no snapshot wipe, no
 * touching matches or intents (5.3). It is fully reversible: re-enabling
 * refreshes from wherever the location now points.
 */
export async function setEnabled(args: {
  enabled: boolean;
  updatedBy?: string;
  /**
   * Skip the enable refresh because the caller has just stored a fresh snapshot
   * for this location. Set by a combined enable-and-re-point save, where
   * `changeLocation` already fetched and committed the new venue's lineup —
   * 5.2 is satisfied by that fetch, and refetching would spend a second Pinball
   * Map call for one save (CORE-PBM-001).
   */
  skipRefresh?: boolean;
}): Promise<SyncResult | { ok: true }> {
  const now = new Date();
  const actor = args.updatedBy ? { updatedBy: args.updatedBy } : {};

  // Set the flag first, upserting so a never-configured singleton is created.
  await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      enabled: args.enabled,
      updatedAt: now,
      ...actor,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { enabled: args.enabled, updatedAt: now, ...actor },
    });

  // Disable: no fetch, no clearing (5.3).
  if (!args.enabled) return { ok: true };

  // The caller already refreshed this location in the same save.
  if (args.skipRefresh) return { ok: true };

  // Enable: refresh the snapshot for the current location (5.2).
  return syncLocationSnapshot(actor);
}
