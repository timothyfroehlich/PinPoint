/**
 * The manual-refresh token bucket, against the real driver (PP-o355.21).
 *
 * ## Why this file exists rather than another case in pinballmap-state.test.ts
 *
 * That suite covers the throttle's behaviour thoroughly on PGlite, and every one
 * of those cases passed for three weeks (PP-hbi0, #1712) while every manual sync
 * in dev and production threw. The old claim interpolated a JS `Date` into a raw
 * `sql` template, which binds with NO type information; postgres.js could not
 * encode it and threw before the statement was sent. PGlite's driver encodes a
 * `Date` without complaint, so no PGlite test could reach the bug no matter how
 * the assertions were written — adding a case there produced a green test and a
 * still-broken button.
 *
 * That is a general limit worth stating plainly: PGlite is the right default for
 * DB logic (CORE-TEST-004), but it is a DIFFERENT driver from production's, so
 * anything depending on parameter encoding — dates, intervals, arrays, jsonb
 * edge cases — is invisible to it. When a query works in the integration suite
 * and fails in the app, suspect the binding before the SQL.
 *
 * The bucket makes that hazard structurally impossible: the clock is `now()`
 * inside the statement, so there is no timestamp to bind at all. The arithmetic
 * that replaced it is not free of risk though — `interval` multiplication,
 * `extract(epoch …)` and `least()` are all things PGlite could agree with while
 * Postgres disagreed — so this file now covers the REFILL, which is the part
 * that lives entirely in SQL.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { pinballmapState } from "~/server/db/schema";

const databaseUrl =
  process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("Missing POSTGRES_URL for the PinballMap throttle test.");
}

// `prepare: false` for the same reason as the sibling credential test: the
// fallback is the Supavisor transaction pooler on `:6543`, which has no
// prepared statements (AGENTS.md "Supabase", PP-d8l8).
const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client, { schema: { pinballmapState } });

const SINGLETON_ID = "singleton";
const LOCATION_ID = 26454;
const BURST = 3;
const REFILL_MS = 3 * 60 * 1000;

/**
 * The production statement, reproduced. Importing `syncLocationSnapshot` would
 * drag in `server-only` plus a PinballMap fetch; the SQL is what is under test,
 * so keep this identical to `stampSyncAttempt` in `src/lib/pinballmap/state.ts`.
 */
const ELAPSED_PERIODS = sql`floor(extract(epoch from (now() - ${pinballmapState.refreshTokensAt})) * 1000 / ${REFILL_MS})`;
const AVAILABLE_TOKENS = sql`least(${BURST}, ${pinballmapState.refreshTokens} + ${ELAPSED_PERIODS})`;

async function claim(attemptAt: Date): Promise<boolean> {
  const claimed = await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: LOCATION_ID,
      lastSyncAttemptAt: attemptAt,
      updatedAt: attemptAt,
      refreshTokens: BURST - 1,
      refreshTokensAt: attemptAt,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: {
        lastSyncAttemptAt: attemptAt,
        updatedAt: attemptAt,
        refreshTokens: sql`${AVAILABLE_TOKENS} - 1`,
        refreshTokensAt: sql`${pinballmapState.refreshTokensAt} + (interval '1 millisecond' * ${REFILL_MS} * ${ELAPSED_PERIODS})`,
      },
      setWhere: sql`${AVAILABLE_TOKENS} >= 1`,
    })
    .returning({ id: pinballmapState.id });
  return claimed.length > 0;
}

/** The cron path: stamps the attempt, spends no token. */
async function stampUnguarded(attemptAt: Date): Promise<void> {
  await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: LOCATION_ID,
      lastSyncAttemptAt: attemptAt,
      updatedAt: attemptAt,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { lastSyncAttemptAt: attemptAt, updatedAt: attemptAt },
    });
}

async function setBucket(tokens: number, tokensAt: Date): Promise<void> {
  await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: LOCATION_ID,
      refreshTokens: tokens,
      refreshTokensAt: tokensAt,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: { refreshTokens: tokens, refreshTokensAt: tokensAt },
    });
}

async function readBucket(): Promise<{ tokens: number; tokensAt: Date }> {
  const [row] = await db
    .select({
      tokens: pinballmapState.refreshTokens,
      tokensAt: pinballmapState.refreshTokensAt,
    })
    .from(pinballmapState)
    .where(eq(pinballmapState.id, SINGLETON_ID));
  if (!row) throw new Error("pinballmap_state singleton missing");
  return row;
}

describe("manual-refresh token bucket (real postgres.js driver)", () => {
  // The singleton is shared state seeded by supabase/seed-pinballmap-state.ts,
  // so each case sets the columns it depends on rather than deleting the row —
  // dropping it would strip `snapshot_json` from every other suite and from the
  // dev database this same stack serves.
  beforeEach(async () => {
    await setBucket(BURST, new Date());
  });

  afterAll(async () => {
    await client.end();
  });

  it("executes the claim instead of failing to bind", async () => {
    // The PP-hbi0 regression, kept as a case because the shape of the statement
    // changed rather than the risk disappearing. Before the original fix this
    // REJECTED with a TypeError from Buffer.byteLength rather than returning
    // either verdict. `.resolves` is the assertion; the boolean is other cases'
    // business.
    await expect(claim(new Date())).resolves.toBeTypeOf("boolean");
  });

  it("allows the full burst back-to-back, then refuses", async () => {
    // The whole reason the flat 3-minute floor was replaced: walking three
    // machines in a row is the ordinary thing to do, and the old guard refused
    // the second one (spec 3.2).
    for (let i = 0; i < BURST; i++) {
      await expect(claim(new Date())).resolves.toBe(true);
    }
    await expect(claim(new Date())).resolves.toBe(false);
  });

  it("grants exactly one token per refill period", async () => {
    // Empty, one period ago: one token back, not two and not the whole burst.
    await setBucket(0, new Date(Date.now() - REFILL_MS - 1000));

    await expect(claim(new Date())).resolves.toBe(true);
    await expect(claim(new Date())).resolves.toBe(false);
  });

  it("never refills past the burst ceiling, however long it has been idle", async () => {
    // `least()` doing its job. Without it, a day of quiet would bank 480 tokens
    // and the sustained-rate commitment (CORE-PBM-001) would mean nothing.
    await setBucket(0, new Date(Date.now() - 24 * 60 * 60 * 1000));

    for (let i = 0; i < BURST; i++) {
      await expect(claim(new Date())).resolves.toBe(true);
    }
    await expect(claim(new Date())).resolves.toBe(false);
  });

  it("keeps partial progress toward the next token", async () => {
    // `refresh_tokens_at` advances by WHOLE periods, not to `now()`. Advancing
    // to now on every claim would discard the fraction already served, so a
    // steady clicker could hold the bucket empty indefinitely.
    const twoAndAHalf = new Date(Date.now() - 2.5 * REFILL_MS);
    await setBucket(0, twoAndAHalf);

    await expect(claim(new Date())).resolves.toBe(true);

    const { tokensAt } = await readBucket();
    // Advanced by exactly two periods — the half-period is still banked.
    expect(tokensAt.getTime()).toBeCloseTo(
      twoAndAHalf.getTime() + 2 * REFILL_MS,
      -3
    );
  });

  it("does not spend a token on the cron path", async () => {
    // The hourly refresh is separately sanctioned. Charging it to the human
    // allowance would let the cron lock people out of their own button.
    await setBucket(BURST, new Date());
    await stampUnguarded(new Date());

    expect((await readBucket()).tokens).toBe(BURST);
  });
});
