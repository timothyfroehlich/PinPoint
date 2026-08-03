/**
 * Integration Test: PinballMap reconcile pass (PP-o355.11, PP-o355.20)
 *
 * `reconcileAfterSync` reads the persisted location snapshot and applies the two
 * writes it is allowed to make: capturing a listing for a matched, unlisted
 * cabinet whose title is on the lineup (auto-link), and healing a stored
 * `pinballmapLmxId` that drifted — same title, new lmx id after a delete+re-add
 * outside PBM's resurrection window. It NEVER auto-unlists a machine that fell
 * off PBM's lineup (that's a human decision on the status page); it only counts
 * those as `desynced` for reporting. No PBM HTTP here — pure DB read/write off
 * the stored snapshot.
 *
 * The write decisions themselves are unit-tested in
 * `src/lib/pinballmap/auto-link.test.ts`; these cover the DB wiring — which rows
 * change, what the counters report, and that each write leaves a receipt.
 */

import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine } from "~/test/helpers/factories";
import { machines, pinballmapState, timelineEvents } from "~/server/db/schema";
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
      enabled: true,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.healed).toBe(1);
    expect(result.linked).toBe(0);
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
    expect(result).toEqual({ healed: 0, linked: 0, desynced: 0 });
  });

  it("writes nothing while the integration is disabled", async () => {
    const db = await getTestDb();
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");

    // "Sync now" does not gate on `enabled` — a human refresh owns that call.
    // The reconcile pass must gate anyway, or one click would auto-list the
    // whole fleet while the integration is switched off.
    const matched = createTestMachine({
      initials: "OF",
      name: "Off",
      pinballmapMachineId: 42,
    });
    await db.insert(machines).values([matched]);
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: false,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    expect(await reconcileAfterSync()).toEqual({
      healed: 0,
      linked: 0,
      desynced: 0,
    });

    const [row] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, matched.id));
    expect(row?.pinballmapListed).toBe(false);
  });

  it("auto-links a matched, unlisted cabinet whose title is on the lineup", async () => {
    const db = await getTestDb();
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");

    // Matched to title 42 but never listed — before PP-o355.20 this was the
    // state APC's whole fleet sat in, reported as "on PBM, not listed here".
    const matched = createTestMachine({
      initials: "AL",
      name: "Auto Linked",
      pinballmapMachineId: 42,
    });
    await db.insert(machines).values([matched]);
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result.linked).toBe(1);
    expect(result.healed).toBe(0);
    // It was the ONLY desynced machine; auto-linking it resolves the desync
    // rather than leaving it to be counted twice over.
    expect(result.desynced).toBe(0);

    const [row] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, matched.id));
    expect(row?.pinballmapListed).toBe(true);
    expect(row?.pinballmapLmxId).toBe(999);

    // A listing that appears with no timeline entry is a change nobody can see.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, matched.id));
    expect(events).toHaveLength(1);
    expect(events[0]?.eventData).toEqual({
      kind: "pinballmap_listing",
      action: "linked",
      lmxId: 999,
    });
    // The hourly pass has no human behind it, so the receipt carries no actor.
    expect(events[0]?.authorId).toBeNull();
  });

  it("stands down on a tie, and does not report the tie as needing attention", async () => {
    const db = await getTestDb();
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");

    // Two cabinets of one title, equally present. PBM gives that title a single
    // lmx, and nothing tells us which cabinet it belongs to — so we choose
    // neither. Crucially the tie must also stay OUT of `desynced`: it raises no
    // alert by design (`listing-holder` §7), and counting it would be the alert.
    const first = createTestMachine({
      initials: "T1",
      name: "Twin One",
      pinballmapMachineId: 42,
    });
    const second = createTestMachine({
      initials: "T2",
      name: "Twin Two",
      pinballmapMachineId: 42,
    });
    await db.insert(machines).values([first, second]);
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result).toEqual({ healed: 0, linked: 0, desynced: 0 });

    const rows = await db.select().from(machines);
    expect(rows.every((r) => !r.pinballmapListed)).toBe(true);
    expect(rows.every((r) => r.pinballmapLmxId === null)).toBe(true);
  });

  it("does not count a same-title cabinet that can never hold the listing", async () => {
    const db = await getTestDb();
    const { reconcileAfterSync } = await import("~/lib/pinballmap/sync");

    // One cabinet holds title 42's listing; a second cabinet of the same title
    // cannot, ever — PBM gives the title one lmx here and the partial unique
    // index enforces one lister. Its "on PBM, not listed here" is therefore not
    // a state any human can clear, so counting it would park a permanent +1 on
    // "N need attention".
    const holder = createTestMachine({
      initials: "HD",
      name: "Holder",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 999,
    });
    const other = createTestMachine({
      initials: "OT",
      name: "Other",
      pinballmapMachineId: 42,
    });
    await db.insert(machines).values([holder, other]);
    await db.insert(pinballmapState).values({
      id: "singleton",
      locationId: 26454,
      enabled: true,
      snapshotJson: snapshotWith([{ id: 999, machineId: 42 }]),
      lastSyncStatus: "ok",
    });

    const result = await reconcileAfterSync();

    expect(result).toEqual({ healed: 0, linked: 0, desynced: 0 });
  });

  it("stands down on a listing collision instead of voiding the whole pass", async () => {
    const db = await getTestDb();
    const { captureAutoLink } = await import("~/lib/pinballmap/sync");

    // `captureAutoLink` is what a concurrent lister races. It must absorb the
    // 23505 and report "did not land" — throwing would, in the reconcile pass,
    // take every other title's link and heal down with it and 500 the cron.
    const incumbent = createTestMachine({
      initials: "IN",
      name: "Incumbent",
      pinballmapMachineId: 42,
      pinballmapListed: true,
      pinballmapLmxId: 999,
    });
    const loser = createTestMachine({
      initials: "LO",
      name: "Loser",
      pinballmapMachineId: 42,
    });
    await db.insert(machines).values([incumbent, loser]);

    const landed = await captureAutoLink({
      machineId: loser.id,
      lmxId: 999,
      action: "linked",
    });

    expect(landed).toBe(false);
    const [row] = await db
      .select()
      .from(machines)
      .where(eq(machines.id, loser.id));
    expect(row?.pinballmapListed).toBe(false);
    // The rolled-back write leaves no receipt for a listing that never happened.
    const events = await db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, loser.id));
    expect(events).toHaveLength(0);
  });
});
