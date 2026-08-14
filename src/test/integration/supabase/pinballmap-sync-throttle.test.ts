/**
 * The manual-sync throttle claim, against the real driver (PP-o355.21).
 *
 * `stampSyncAttempt`'s conditional upsert compares `last_sync_attempt_at`
 * against a threshold `Date`. From PP-hbi0 (#1712) until this test, that
 * threshold was interpolated into a raw `sql` template, which binds a value
 * with NO type information — Drizzle applies a column's mapper only where it
 * knows the column, which covers `values`/`set` but not an operand inside a
 * fragment. postgres.js then received a `Date` it cannot encode and threw
 * `The "string" argument must be of type string or an instance of Buffer`
 * before the statement was ever sent.
 *
 * ## Why this file exists rather than another case in pinballmap-state.test.ts
 *
 * That suite already covers this throttle thoroughly — refusal inside the
 * interval, refusal after a FAILED attempt, cron never blocked — and every one
 * of those passed for three weeks while every manual sync in dev and production
 * threw. They run on PGlite, whose driver encodes a JS `Date` without
 * complaint. The bug lives strictly in the postgres.js binding, so no PGlite
 * test can reach it no matter how the assertions are written, and adding a case
 * there would have produced a green test and a still-broken button.
 *
 * That is a general limit worth stating plainly: PGlite is the right default
 * for DB logic (CORE-TEST-004), but it is a DIFFERENT driver from the one
 * production uses, so anything that depends on parameter encoding — dates,
 * intervals, arrays, custom types, jsonb edge cases — is invisible to it. When
 * a query works in the integration suite and fails in the app, suspect the
 * binding before the SQL.
 *
 * Deliberately narrow: it asserts the statement EXECUTES and that the guard
 * still discriminates. The throttle's behaviour is pinned by the PGlite suite;
 * duplicating it here would pay a real-Supabase run for coverage that already
 * exists.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, lt, sql } from "drizzle-orm";
import { pinballmapState } from "~/server/db/schema";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("Missing POSTGRES_URL for the PinballMap throttle test.");
}

// `prepare: false` for the same reason as the sibling credential test: the
// fallback is the Supavisor transaction pooler on `:6543`, which has no
// prepared statements (AGENTS.md §7, PP-d8l8).
const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client, { schema: { pinballmapState } });

const SINGLETON_ID = "singleton";
const LOCATION_ID = 26454;
const INTERVAL_MS = 3 * 60 * 1000;

/**
 * The production statement, reproduced. Importing `syncLocationSnapshot` would
 * drag in `server-only` plus a PinballMap fetch; the binding is what is under
 * test, so the upsert is what is mirrored — keep it identical to
 * `stampSyncAttempt` in `src/lib/pinballmap/state.ts`.
 */
async function claim(attemptAt: Date): Promise<boolean> {
  const threshold = new Date(attemptAt.getTime() - INTERVAL_MS);
  const values = {
    id: SINGLETON_ID,
    locationId: LOCATION_ID,
    lastSyncAttemptAt: attemptAt,
    updatedAt: attemptAt,
  };
  const claimed = await db
    .insert(pinballmapState)
    .values(values)
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { lastSyncAttemptAt: attemptAt, updatedAt: attemptAt },
      setWhere: sql`${isNull(pinballmapState.lastSyncAttemptAt)} or ${lt(pinballmapState.lastSyncAttemptAt, threshold)}`,
    })
    .returning({ id: pinballmapState.id });
  return claimed.length > 0;
}

async function setLastAttempt(at: Date | null): Promise<void> {
  await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: LOCATION_ID,
      lastSyncAttemptAt: at,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { lastSyncAttemptAt: at },
    });
}

describe("manual-sync throttle binding (real postgres.js driver)", () => {
  // The singleton is shared state seeded by supabase/seed-pinballmap-state.ts,
  // so each case sets the one column it depends on rather than deleting the
  // row — dropping it would strip `snapshot_json` from every other suite and
  // from the dev database this same stack serves.
  beforeEach(async () => {
    await setLastAttempt(null);
  });

  afterAll(async () => {
    await client.end();
  });

  it("executes the conditional upsert instead of failing to bind the threshold", async () => {
    // The regression itself: before the fix this REJECTED with a TypeError from
    // Buffer.byteLength rather than returning either verdict. `.resolves` is
    // the assertion — the boolean is the next test's business.
    await expect(claim(new Date())).resolves.toBeTypeOf("boolean");
  });

  it("claims when no attempt has been recorded", async () => {
    await expect(claim(new Date())).resolves.toBe(true);
  });

  it("refuses a second claim inside the interval and allows one outside it", async () => {
    const now = new Date();

    await setLastAttempt(new Date(now.getTime() - 60 * 1000));
    await expect(claim(now)).resolves.toBe(false);

    // Just past the interval. Proves the comparison is a real timestamp
    // comparison and not, say, a string compare that happens to order right —
    // one minute and four minutes both stringify to the same prefix.
    await setLastAttempt(new Date(now.getTime() - (INTERVAL_MS + 1000)));
    await expect(claim(now)).resolves.toBe(true);
  });

  it("advances the stored attempt timestamp when it claims", async () => {
    const attemptAt = new Date();
    await expect(claim(attemptAt)).resolves.toBe(true);

    const [row] = await db
      .select({ lastSyncAttemptAt: pinballmapState.lastSyncAttemptAt })
      .from(pinballmapState)
      .where(eq(pinballmapState.id, SINGLETON_ID));

    // Round-trips as a Date through the driver, and lands on the value we sent
    // — the other half of "the binding works", since a threshold that bound but
    // encoded wrong would still refuse or claim at the wrong moments.
    expect(row?.lastSyncAttemptAt?.getTime()).toBe(attemptAt.getTime());
  });
});
