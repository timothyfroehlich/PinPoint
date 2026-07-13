import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { getCollection } from "~/lib/collections/user";

describe("getCollection", () => {
  setupTestDb();

  async function seed() {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Cara", lastName: "Curator" });
    const other = createTestUser({ firstName: "Dan", lastName: "Other" });
    await db.insert(userProfiles).values([owner, other]);

    // Machines span two owners — a collection may include machines the
    // curator does not own.
    const zeta = createTestMachine({
      initials: "ZZ",
      name: "Zeta",
      ownerId: owner.id,
    });
    const alpha = createTestMachine({
      initials: "AA",
      name: "Alpha",
      ownerId: other.id,
    });
    const excluded = createTestMachine({
      initials: "XX",
      name: "Excluded",
      ownerId: owner.id,
    });
    await db.insert(machines).values([zeta, alpha, excluded]);

    await db.insert(issues).values([
      createTestIssue("ZZ", {
        issueNumber: 1,
        title: "open",
        status: "new",
        severity: "major",
      }),
      createTestIssue("ZZ", {
        issueNumber: 2,
        title: "closed",
        status: "fixed",
        severity: "unplayable",
      }),
    ]);

    const [collection] = await db
      .insert(collections)
      .values({ name: "Summer Classic", ownerId: owner.id })
      .returning();
    await db.insert(collectionMachines).values([
      { collectionId: collection.id, machineId: zeta.id },
      { collectionId: collection.id, machineId: alpha.id },
    ]);
    return { db, owner, collection, zeta, alpha };
  }

  it("returns members (both owners' machines) with open issues only, sorted by name", async () => {
    const { owner, collection } = await seed();
    const db = await getTestDb();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Summer Classic");
    expect(result?.owner).toEqual({ id: owner.id, name: "Cara Curator" });
    expect(result?.machines.map((m) => m.initials)).toEqual(["AA", "ZZ"]);
    const zetaRow = result?.machines.find((m) => m.initials === "ZZ");
    expect(zetaRow?.issues).toEqual([
      { status: "new", severity: "major", createdAt: expect.any(Date) },
    ]);
  });

  it("excludes non-member machines", async () => {
    const { collection } = await seed();
    const db = await getTestDb();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result?.machines.map((m) => m.initials)).not.toContain("XX");
  });

  it("returns an empty machine list for a collection with no members", async () => {
    const db = await getTestDb();
    const owner = createTestUser();
    await db.insert(userProfiles).values(owner);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Empty", ownerId: owner.id })
      .returning();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result?.machines).toEqual([]);
  });

  it("returns null for unknown or malformed ids", async () => {
    const db = await getTestDb();
    expect(await getCollection(asDbOrTx(db), randomUUID())).toBeNull();
    expect(await getCollection(asDbOrTx(db), "not-a-uuid")).toBeNull();
  });
});
