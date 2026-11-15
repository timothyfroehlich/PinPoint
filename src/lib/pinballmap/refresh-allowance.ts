import "server-only";
import { eq, isNull, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { pinballmapState } from "~/server/db/schema";
import { PBM_REFRESH_BURST, PBM_REFRESH_REFILL_MS } from "./config";
import { PINBALLMAP_STATE_ID, availableMutationLease } from "./mutation-lease";
import { getPinballMapState, hasReturnedRow } from "./runtime-state";

/**
 * The shared manual-refresh token bucket (PP-hbi0, spec 3.2): burst
 * `PBM_REFRESH_BURST`, one token back every `PBM_REFRESH_REFILL_MS`. Every human
 * PBM read spends from it through `stampSyncAttempt`; the hourly cron records
 * its attempt without spending.
 */

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
 * How long until a refused manual read could claim a token, for a `throttled`
 * result.
 *
 * Re-reads rather than reusing a row loaded before the claim: the claim just
 * lost was won by somebody, so the bucket moved and a pre-claim copy would
 * report a refill time that has already passed.
 */
export async function refreshRetryAfterMs(at: Date): Promise<number> {
  const { nextRefillAt } = await getRefreshAllowance(at);
  return Math.max(
    0,
    (nextRefillAt?.getTime() ?? at.getTime() + PBM_REFRESH_REFILL_MS) -
      at.getTime()
  );
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
const ELAPSED_PERIODS = sql`greatest(0, floor(extract(epoch from (now() - ${pinballmapState.refreshTokensAt})) * 1000 / ${PBM_REFRESH_REFILL_MS}))`;

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
 * - `guarded === false` (cron): unconditional stamp, no token spent. The hourly
 *   refresh is separately sanctioned, and charging it to the human allowance
 *   would let the cron lock people out of their own button.
 * - `guarded === true` (manual): the `DO UPDATE` fires only while a token is
 *   available; an empty `RETURNING` means throttled. The stamp is on the last
 *   ATTEMPT, not the last success, so a failed fetch (429/500) still spends its
 *   token rather than fail-opening into a retry loop (CORE-PBM-001).
 *
 * `refreshTokensAt` advances by whole refill periods while refilling below
 * capacity so the fraction of a period already served is not thrown away on every
 * claim (otherwise a steady clicker could hold the bucket empty indefinitely),
 * but resets to `now()` when the bucket reaches or is at full burst capacity so
 * unconsumed idle time beyond the ceiling is not banked.
 */
export async function stampSyncAttempt(
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
    id: PINBALLMAP_STATE_ID,
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
    // Check ID spends the shared traffic allowance but is not an
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
        "refresh_tokens_at" = CASE
          WHEN ${AVAILABLE_TOKENS} >= ${PBM_REFRESH_BURST} THEN now()
          ELSE ${pinballmapState.refreshTokensAt}
            + (interval '1 millisecond' * ${PBM_REFRESH_REFILL_MS} * ${ELAPSED_PERIODS})
        END
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
      "refresh_tokens_at" = CASE
        WHEN ${AVAILABLE_TOKENS} >= ${PBM_REFRESH_BURST} THEN now()
        ELSE ${pinballmapState.refreshTokensAt}
          + (interval '1 millisecond' * ${PBM_REFRESH_REFILL_MS} * ${ELAPSED_PERIODS})
      END
    WHERE ${AVAILABLE_TOKENS} >= 1
      AND ${locationGuard}
      AND "pinballmap_state"."configuration_generation" = ${expectedGeneration}
      AND ${leaseGuard}
    RETURNING "id"
  `);
  return hasReturnedRow(claimed);
}
