import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { getMyCollections } from "~/lib/collections/list";

describe("getMyCollections", () => {
  setupTestDb();

  it("returns the owner's collections sorted by name with machine counts, excluding others'", async () => {
    const db = await getTestDb();
    const a = createTestUser({ firstName: "Ann", lastName: "Owner" });
    const b = createTestUser({ firstName: "Bob", lastName: "Other" });
    await db.insert(userProfiles).values([a, b]);

    const m1 = createTestMachine({ initials: "M1", name: "One" });
    const m2 = createTestMachine({ initials: "M2", name: "Two" });
    await db.insert(machines).values([m1, m2]);

    const inserted = await db
      .insert(collections)
      .values([
        { name: "Zephyr", ownerId: a.id },
        { name: "Aurora", ownerId: a.id },
        { name: "Bob's", ownerId: b.id },
      ])
      .returning();
    const zephyr = inserted.find((c) => c.name === "Zephyr");
    if (!zephyr) throw new Error("seed failed");

    // Zephyr has 2 machines; Aurora is empty; Bob's belongs to another owner.
    await db.insert(collectionMachines).values([
      { collectionId: zephyr.id, machineId: m1.id },
      { collectionId: zephyr.id, machineId: m2.id },
    ]);

    const result = await getMyCollections(asDbOrTx(db), a.id);
    expect(result.map((c) => c.name)).toEqual(["Aurora", "Zephyr"]);
    expect(result.map((c) => c.machineCount)).toEqual([0, 2]);
  });

  it("returns an empty array for an owner with no collections", async () => {
    const db = await getTestDb();
    const user = createTestUser();
    await db.insert(userProfiles).values(user);
    expect(await getMyCollections(asDbOrTx(db), user.id)).toEqual([]);
  });
});
