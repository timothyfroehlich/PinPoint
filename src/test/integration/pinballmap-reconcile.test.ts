/**
 * Integration Test: PinballMap reconcile pass (PP-o355.11)
 *
 * `reconcileAfterSync` reads the persisted location snapshot and heals stored
 * `pinballmapLmxId` drift — the title is still on PBM, just under a new lmx id
 * (a delete+re-add outside PBM's resurrection window). It NEVER auto-unlists a
 * machine that fell off PBM's lineup (that's a human decision on the status
 * page); it only counts those as `desynced` for reporting. No PBM HTTP here —
 * pure DB read/write off the stored snapshot.
 */

import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import { machines, pinballmapState } from "~/server/db/schema";
import type { LocationSnapshot } from "~/lib/pinballmap/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const snapshotWith = (
  rows: { id: number; machineId: number }[]
): LocationSnapshot => ({
  locationId: 26454,
  name: "APC",
  dateLastUpdated: null,
  lastUpdatedByUsername: null,
  machineCount: rows.length,
  lmxes: rows.map((r) => ({
    ...r,
    icEnabled: null,
    lastUpdatedByUsername: null,
    conditions: [],
  })),
  fetchedAtIso: "2026-07-16T00:00:00Z",
  raw: {},
});

describe("reconcileAfterSync (PGlite)", () => {
  setupTestDb();

  it("heals a drifted lmx id and counts (but does not touch) an absent listing", async () => {
    const db = await getTestDb();
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");

    // A: linked + listed, stored lmx 900. Snapshot shows title 42 under lmx 999
    //    → drifted, should heal to 999.
    const drifted = createTestMachine({
      initials: "DR",
      name: "Drifted",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 900,
    });
    // B: linked + listed, stored lmx 910. Snapshot has NO row for title 43
    //    → listed-locally-absent-on-PBM: counted desynced, row left untouched.
    const absent = createTestMachine({
      initials: "AB",
      name: "Absent",
      pinballmapMachineId: 43,
      pinballmapListed: true,
      pinballmapLmxId: 910,
    });
    await db.insert(machines).values([drifted, absent]);

    // Persist the snapshot the reconcile pass reads (title 42 under lmx 999;
    // title 43 absent).
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.healed).toBe(1);
    expect(result.desynced).toBe(1);

    const [healedRow] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, drifted.id));
    expect(healedRow?.pinballmapLmxId).toBe(999);

    const [absentRow] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, absent.id));
    // No auto-unlist, no lmx change — a human resolves it on the status page.
    expect(absentRow?.pinballmapLmxId).toBe(910);
    expect(absentRow?.pinballmapListed).toBe(true);
  });

  it("returns zeroes when there is no stored snapshot", async () => {
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");
    const result = await reconcileAfterSync();
    expect(result).toEqual({ healed: 0, desynced: 0 });
  });
});
