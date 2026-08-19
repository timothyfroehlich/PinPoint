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

// `listSurfacingAbandonedForMachine` reads through `~/server/db`; point that at
// the worker's PGlite instance so it sees the rows seeded below.
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

/**
 * The surfacing filter's location scoping (spec 6.4 / 6.9).
 *
 * The hiding rule — "a same-title cabinet is already handling this entry, so
 * don't show it here too" — is a claim about the TRACKED location's lineup. A
 * record kept across a re-point lives on a different lineup, so nothing here is
 * handling it, and hiding it strands the record: `clearResolvedAbandonments` is
 * location-scoped too, so the only path that ever removes it is the explicit
 * Remove on the page the filter just hid it from.
 */
describe("listSurfacingAbandonedForMachine — location scoping", () => {
  setupTestDb();

  async function seedRecord(
    initials: string,
    locationId: number
  ): Promise<string> {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({ name: "Godzilla", initials })
      .returning();
    await db.insert(pinballmapAbandonedListings).values({
      machineId: machine.id,
      lmxId: 4471,
      pinballmapMachineId: 6221,
      locationId,
    });
    // A DIFFERENT cabinet in the fleet still carries the abandoned title. This
    // is what triggers the hiding rule.
    await db
      .insert(machines)
      .values({
        name: "Godzilla (Premium)",
        initials: `${initials}X`,
        pinballmapMachineId: 6221,
      })
      .returning();
    return machine.id;
  }

  it("hides a same-location record whose title a sibling still carries", async () => {
    const machineId = await seedRecord("SL", 26454);
    const { listSurfacingAbandonedForMachine } =
      await import("~/lib/pinballmap/abandoned-listings");

    expect(await listSurfacingAbandonedForMachine(machineId, 26454)).toEqual(
      []
    );
  });

  it("still surfaces a cross-location record under the same conditions", async () => {
    const machineId = await seedRecord("XL", 26454);
    const { listSurfacingAbandonedForMachine } =
      await import("~/lib/pinballmap/abandoned-listings");

    // Tracking moved to 99999; the record is stamped 26454. The sibling cabinet
    // carrying title 6221 is on the NEW location's lineup and says nothing
    // about the orphan still live at 26454 — so it must not hide it.
    const rows = await listSurfacingAbandonedForMachine(machineId, 99999);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locationId).toBe(26454);
  });
});
