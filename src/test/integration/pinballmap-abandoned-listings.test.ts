/**
 * Integration: the abandoned-listings table's own guarantees (PP-l81u).
 *
 * Behaviour that writes these rows is covered in
 * `pinballmap-retitle-abandonment.test.ts`; this file pins the constraints the
 * table itself has to enforce.
 */

import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";

import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, pinballmapAbandonedListings } from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

describe("pinballmap_abandoned_listings", () => {
  setupTestDb();

  it("cascades when the machine is deleted", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });

    await db.delete(machines).where(eq(machines.id, machine.id));

    const rows = await db.select().from(pinballmapAbandonedListings);
    expect(rows).toHaveLength(0);
  });

  it("refuses a second row for the same lmx", async () => {
    const db = await getTestDb();
    const [a] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ2" })
      .returning();
    const [b] = await db
      .insert(machines)
      .values({ name: "Godzilla Two", initials: "GZ3" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values({
      machineId: a.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId: 26454,
    });

    await expect(
      db.insert(pinballmapAbandonedListings).values({
        machineId: b.id,
        lmxId: 4471,
        pinballmapMachineId: 6221,
        locationId: 26454,
      })
    ).rejects.toThrow();
  });

  it("holds several abandonments for one machine", async () => {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials: "GZ4" })
      .returning();

    await db.insert(pinballmapAbandonedListings).values([
      {
        machineId: machine.id,
        lmxId: 4471,
        pinballmapMachineId: 6221,
        locationId: 26454,
      },
      {
        machineId: machine.id,
        lmxId: 5120,
        pinballmapMachineId: 6222,
        locationId: 26454,
      },
    ]);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows).toHaveLength(2);
  });
});

describe("abandoned-listing location scoping", () => {
  setupTestDb();

  async function seedRecord(locationId: number): Promise<string> {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Orphan owner", initials: `O${String(locationId)}` })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: locationId,
      pinballmapMachineId: 6221,
      locationId,
    });
    await db.insert(machines).values({
      name: "Same-title sibling",
      initials: `S${String(locationId)}`,
      pinballmapMachineId: 6221,
    });
    return machine.id;
  }

  it("keeps cross-location records visible when a current-location sibling has the title", async () => {
    const machineId = await seedRecord(99999);
    const { listSurfacingAbandonedForMachine } =
      await import("~/lib/pinballmap/abandoned-listings");

    const records = await listSurfacingAbandonedForMachine(machineId, 26454);
    expect(records).toHaveLength(1);
    expect(records[0]?.locationId).toBe(99999);
  });

  it("reconciles only records stamped with the synced location", async () => {
    const db = await getTestDb();
    const sameLocationMachineId = await seedRecord(26454);
    const crossLocationMachineId = await seedRecord(99999);
    // Coverage would clear both rows without the location predicate.
    await db
      .update(machines)
      .set({ pinballmapIntent: "on" })
      .where(eq(machines.pinballmapMachineId, 6221));

    const { clearResolvedAbandonments } =
      await import("~/lib/pinballmap/abandoned-listings");
    const cleared = await clearResolvedAbandonments(
      {
        locationId: 26454,
        name: "APC",
        dateLastUpdated: null,
        lastUpdatedByUsername: null,
        machineCount: 0,
        lmxes: [],
        fetchedAtIso: "2026-08-31T00:00:00.000Z",
        raw: {},
      },
      26454
    );

    expect(cleared).toBe(1);
    const records = await db.select().from(pinballmapAbandonedListings);
    expect(records).toHaveLength(1);
    expect(records[0]?.machineId).toBe(crossLocationMachineId);
    expect(records[0]?.machineId).not.toBe(sameLocationMachineId);
  });
});
