import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  collectionCollaborators,
  machines,
  userProfiles,
} from "~/server/db/schema";
import {
  getMyCollections,
  getOwnedMachineCount,
  getSharedWithMe,
} from "~/lib/collections/list";

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

describe("getOwnedMachineCount", () => {
  setupTestDb();

  it("counts only the machines owned by the given user", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Ann", lastName: "Owner" });
    const other = createTestUser({ firstName: "Bob", lastName: "Other" });
    await db.insert(userProfiles).values([owner, other]);

    await db
      .insert(machines)
      .values([
        createTestMachine({ initials: "M1", name: "One", ownerId: owner.id }),
        createTestMachine({ initials: "M2", name: "Two", ownerId: owner.id }),
        createTestMachine({ initials: "M3", name: "Three", ownerId: other.id }),
      ]);

    expect(await getOwnedMachineCount(asDbOrTx(db), owner.id)).toBe(2);
  });

  it("returns 0 for a user who owns no machines", async () => {
    const db = await getTestDb();
    const user = createTestUser();
    await db.insert(userProfiles).values(user);
    expect(await getOwnedMachineCount(asDbOrTx(db), user.id)).toBe(0);
  });
});

describe("getSharedWithMe", () => {
  setupTestDb();

  it("returns collections shared with the user, with owner name + machine count", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Owner", lastName: "One" });
    const me = createTestUser({ firstName: "Me", lastName: "User" });
    await db.insert(userProfiles).values([owner, me]);
    const m1 = createTestMachine({ initials: "M1", name: "One" });
    await db.insert(machines).values(m1);
    const [shared] = await db
      .insert(collections)
      .values({ name: "Shared C", ownerId: owner.id })
      .returning();
    if (!shared) throw new Error("seed failed");
    await db
      .insert(collectionMachines)
      .values({ collectionId: shared.id, machineId: m1.id });
    await db.insert(collectionCollaborators).values({
      collectionId: shared.id,
      userId: me.id,
      role: "editor",
      addedBy: owner.id,
    });

    const rows = await getSharedWithMe(asDbOrTx(db), me.id);
    expect(rows).toEqual([
      {
        id: shared.id,
        name: "Shared C",
        machineCount: 1,
        ownerName: "Owner One",
      },
    ]);
  });

  it("excludes collections the user only owns", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Owner", lastName: "One" });
    await db.insert(userProfiles).values(owner);
    await db.insert(collections).values({ name: "Mine", ownerId: owner.id });
    expect(await getSharedWithMe(asDbOrTx(db), owner.id)).toEqual([]);
  });
});
