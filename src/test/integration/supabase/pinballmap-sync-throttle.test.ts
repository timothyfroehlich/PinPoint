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

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { pinballmapState } from "~/server/db/schema";
import { syncLocationSnapshot } from "~/lib/pinballmap/state";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

const { client, db } = await vi.hoisted(async () => {
  const databaseUrl =
    process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
  if (!databaseUrl)
    throw new Error("Missing POSTGRES_URL for the PinballMap throttle test.");
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const schema = await import("~/server/db/schema");
  // Supavisor's transaction pooler does not support prepared statements.
  const client = postgres(databaseUrl, { prepare: false });
  return { client, db: drizzle(client, { schema }) };
});
vi.mock("server-only", () => ({}));
vi.mock("~/server/db", () => ({ db }));
vi.mock("~/lib/pinballmap/client", () => ({
  getPinballMapClient: () =>
    Promise.resolve({ fetchLocation: () => Promise.resolve(snapshot) }),
}));

const snapshot: LocationSnapshot = {
  locationId: 26454,
  name: "Local throttle fixture",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: 0,
  lmxes: [],
  fetchedAtIso: "2026-09-12T12:00:00.000Z",
  raw: {},
};
let originalState: typeof pinballmapState.$inferSelect | undefined;
let originalStateRead = false;

const SINGLETON_ID = "singleton";
const LOCATION_ID = 26454;
const BURST = 3;
const REFILL_MS = 3 * 60 * 1000;

async function setBucket(tokens: number, tokensAt: Date): Promise<void> {
  await db
    .insert(pinballmapState)
    .values({
      id: SINGLETON_ID,
      locationId: LOCATION_ID,
      refreshTokens: tokens,
      refreshTokensAt: tokensAt,
      configurationGeneration: 0,
      mutationLeaseId: null,
      mutationLeaseExpiresAt: null,
    })
    .onConflictDoUpdate({
      target: pinballmapState.id,
      set: {
        locationId: LOCATION_ID,
        configurationGeneration: 0,
        mutationLeaseId: null,
        mutationLeaseExpiresAt: null,
        refreshTokens: tokens,
        refreshTokensAt: tokensAt,
      },
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
  // the production sync changes health and snapshot fields too, so afterAll
  // restores the full original singleton before releasing the connection.
  beforeAll(async () => {
    originalState = await db.query.pinballmapState.findFirst({
      where: eq(pinballmapState.id, SINGLETON_ID),
    });
    originalStateRead = true;
  });

  beforeEach(async () => {
    await setBucket(BURST, new Date());
  });

  afterAll(async () => {
    try {
      if (originalState) {
        await db
          .insert(pinballmapState)
          .values(originalState)
          .onConflictDoUpdate({
            target: pinballmapState.id,
            set: originalState,
          });
      } else if (originalStateRead) {
        await db
          .delete(pinballmapState)
          .where(eq(pinballmapState.id, SINGLETON_ID));
      }
    } finally {
      await client.end();
    }
  });

  it("executes the claim instead of failing to bind", async () => {
    // The PP-hbi0 regression, kept as a case because the shape of the statement
    // changed rather than the risk disappearing. Before the original fix this
    // REJECTED with a TypeError from Buffer.byteLength rather than returning
    // a successful sync. The production owner and real driver both run here.
    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: true });
  });

  it("allows the full burst back-to-back, then refuses", async () => {
    // The whole reason the flat 3-minute floor was replaced: walking three
    // machines in a row is the ordinary thing to do, and the old guard refused
    // the second one (spec 3.2).
    for (let i = 0; i < BURST; i++) {
      await expect(
        syncLocationSnapshot({ trigger: "manual" })
      ).resolves.toMatchObject({ ok: true });
    }
    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: false, reason: "throttled" });
  });

  it("grants exactly one token per refill period", async () => {
    // Empty, one period ago: one token back, not two and not the whole burst.
    await setBucket(0, new Date(Date.now() - REFILL_MS - 1000));

    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: true });
    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: false, reason: "throttled" });
  });

  it("never refills past the burst ceiling, however long it has been idle", async () => {
    // `least()` doing its job. Without it, a day of quiet would bank 480 tokens
    // and the sustained-rate commitment (CORE-PBM-001) would mean nothing.
    await setBucket(0, new Date(Date.now() - 24 * 60 * 60 * 1000 - 1000));

    for (let i = 0; i < BURST; i++) {
      await expect(
        syncLocationSnapshot({ trigger: "manual" })
      ).resolves.toMatchObject({ ok: true });
    }
    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: false, reason: "throttled" });
  });

  it("keeps partial progress toward the next token", async () => {
    // `refresh_tokens_at` advances by WHOLE periods, not to `now()`. Advancing
    // to now on every claim would discard the fraction already served, so a
    // steady clicker could hold the bucket empty indefinitely.
    const twoAndAHalf = new Date(Date.now() - 2.5 * REFILL_MS);
    await setBucket(0, twoAndAHalf);

    await expect(
      syncLocationSnapshot({ trigger: "manual" })
    ).resolves.toMatchObject({ ok: true });

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
    await expect(
      syncLocationSnapshot({ trigger: "cron" })
    ).resolves.toMatchObject({ ok: true });

    expect((await readBucket()).tokens).toBe(BURST);
  });
});
