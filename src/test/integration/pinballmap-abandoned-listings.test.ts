/**
 * Integration: the abandoned-listings table's own guarantees (PP-l81u).
 *
 * Behaviour that writes these rows is covered in
 * `pinballmap-retitle-abandonment.test.ts`; this file pins the constraints the
 * table itself has to enforce.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";

import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, pinballmapAbandonedListings } from "~/server/db/schema";

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
    });

    await expect(
      db.insert(pinballmapAbandonedListings).values({
        machineId: b.id,
        lmxId: 4471,
        pinballmapMachineId: 6221,
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
      { machineId: machine.id, lmxId: 4471, pinballmapMachineId: 6221 },
      { machineId: machine.id, lmxId: 5120, pinballmapMachineId: 6222 },
    ]);

    const rows = await db
      .select()
      .from(pinballmapAbandonedListings)
      .where(eq(pinballmapAbandonedListings.machineId, machine.id));
    expect(rows).toHaveLength(2);
  });
});
