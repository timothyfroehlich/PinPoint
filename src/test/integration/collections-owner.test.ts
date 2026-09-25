import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import { machines, userProfiles } from "~/server/db/schema";
import { getOwnerCollection } from "~/lib/collections/owner";

describe("getOwnerCollection", () => {
  setupTestDb();

  it("returns the owner's minimal machine identities sorted by name", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Alice", lastName: "Owner" });
    const other = createTestUser({ firstName: "Bob", lastName: "Other" });
    await db.insert(userProfiles).values([owner, other]);

    const zeta = createTestMachine({
      initials: "ZZ",
      name: "Zeta",
      ownerId: owner.id,
    });
    const alpha = createTestMachine({
      initials: "AA",
      name: "Alpha",
      ownerId: owner.id,
    });
    const notMine = createTestMachine({
      initials: "BB",
      name: "NotMine",
      ownerId: other.id,
    });
    await db.insert(machines).values([zeta, alpha, notMine]);

    const collection = await getOwnerCollection(asDbOrTx(db), owner.id);
    expect(collection).not.toBeNull();
    expect(collection?.owner).toEqual({ id: owner.id, name: "Alice Owner" });
    expect(collection?.machines.map((m) => m.initials)).toEqual(["AA", "ZZ"]);
    expect(collection?.machines[0]).toEqual({
      id: alpha.id,
      initials: "AA",
      name: "Alpha",
      presenceStatus: "on_the_floor",
    });
  });

  it("returns an empty machine list for an owner with no machines", async () => {
    const db = await getTestDb();
    const owner = createTestUser();
    await db.insert(userProfiles).values(owner);

    const collection = await getOwnerCollection(asDbOrTx(db), owner.id);
    expect(collection?.machines).toEqual([]);
  });

  it("returns null for unknown or malformed user ids", async () => {
    const db = await getTestDb();
    expect(await getOwnerCollection(asDbOrTx(db), randomUUID())).toBeNull();
    expect(await getOwnerCollection(asDbOrTx(db), "not-a-uuid")).toBeNull();
  });
});
