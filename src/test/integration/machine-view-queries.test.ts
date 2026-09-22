import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const {
  getLatestMachineServiceDates,
  getMachineViewHealth,
  loadMachineViewFromDatabase,
} = await import("~/lib/machines/view/queries");

describe("machine view database pipeline", () => {
  setupTestDb();

  const ownerOneId = randomUUID();
  const ownerTwoId = randomUUID();
  const collectionId = randomUUID();
  const alphaId = randomUUID();
  const betaId = randomUUID();
  const gammaId = randomUUID();

  beforeEach(async () => {
    const db = await getTestDb();
    await db.insert(userProfiles).values([
      createTestUser({
        id: ownerOneId,
        firstName: "Owner",
        lastName: "One",
      }),
      createTestUser({
        id: ownerTwoId,
        firstName: "Owner",
        lastName: "Two",
      }),
    ]);
    await db.insert(machines).values([
      createTestMachine({
        id: alphaId,
        initials: "AAA",
        name: "Alpha",
        ownerId: ownerOneId,
      }),
      createTestMachine({
        id: betaId,
        initials: "BBB",
        name: "Beta",
        ownerId: ownerOneId,
      }),
      createTestMachine({
        id: gammaId,
        initials: "CCC",
        name: "Gamma",
        ownerId: ownerTwoId,
      }),
    ]);
    await db.insert(collections).values({
      id: collectionId,
      name: "Mixed Collection",
      ownerId: ownerOneId,
    });
    await db.insert(collectionMachines).values([
      { collectionId, machineId: alphaId, addedBy: ownerOneId },
      { collectionId, machineId: gammaId, addedBy: ownerOneId },
    ]);
  });

  it("aggregates only open issues with severity counts and oldest date", async () => {
    const db = await getTestDb();
    const oldest = new Date("2026-01-01T00:00:00.000Z");
    await db.insert(issues).values([
      createTestIssue("AAA", {
        issueNumber: 1,
        severity: "cosmetic",
        createdAt: oldest,
      }),
      createTestIssue("AAA", {
        issueNumber: 2,
        severity: "major",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      }),
      createTestIssue("AAA", {
        issueNumber: 3,
        severity: "unplayable",
        status: "fixed",
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      }),
    ]);

    const health = await getMachineViewHealth(asDbOrTx(db), ["AAA", "BBB"]);
    expect(health.get("AAA")).toEqual({
      openIssues: 2,
      bySeverity: { cosmetic: 1, minor: 0, major: 1, unplayable: 0 },
      worstSeverity: "major",
      oldestOpenIssueAt: oldest.toISOString(),
      playability: "needs_service",
    });
    expect(health.has("BBB")).toBe(false);
  });

  it("selects the latest non-deleted service event and ignores other tags", async () => {
    const db = await getTestDb();
    const selected = new Date("2026-02-01T00:00:00.000Z");
    await db.insert(timelineEvents).values([
      {
        machineId: alphaId,
        sourceType: "comment",
        tag: "maintenance",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        machineId: alphaId,
        sourceType: "comment",
        tag: "inspection",
        createdAt: selected,
      },
      {
        machineId: alphaId,
        sourceType: "comment",
        tag: "note",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        machineId: alphaId,
        sourceType: "comment",
        tag: "cleaning",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        deletedAt: new Date("2026-04-02T00:00:00.000Z"),
        deletedBy: ownerOneId,
      },
    ]);

    const dates = await getLatestMachineServiceDates(asDbOrTx(db), [alphaId]);
    expect(dates.get(alphaId)).toEqual(selected);
  });

  it("keeps all, collection, and owner scopes exact", async () => {
    const db = await getTestDb();
    const searchParams = new URLSearchParams({
      presence: "all",
      columns: "machine",
    });

    const tx = asDbOrTx(db);
    const all = await loadMachineViewFromDatabase(tx, {
      scope: { kind: "all" },
      preset: "machines",
      searchParams,
    });
    const collection = await loadMachineViewFromDatabase(tx, {
      scope: { kind: "collection", collectionId },
      preset: "collection",
      searchParams,
    });
    const owner = await loadMachineViewFromDatabase(tx, {
      scope: { kind: "owner", ownerId: ownerOneId },
      preset: "collection",
      searchParams,
    });

    expect(all.rows.map((row) => row.initials)).toEqual(["AAA", "BBB", "CCC"]);
    expect(collection.rows.map((row) => row.initials)).toEqual(["AAA", "CCC"]);
    expect(owner.rows.map((row) => row.initials)).toEqual(["AAA", "BBB"]);
    expect(all.rows.every((row) => row.health === undefined)).toBe(true);
    expect(all.rows.every((row) => row.lastServicedAt === undefined)).toBe(
      true
    );
  });

  it("ignores owner IDs that are not available in the active scope", async () => {
    const db = await getTestDb();
    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "owner", ownerId: ownerOneId },
      preset: "collection",
      searchParams: new URLSearchParams({
        owner: `${ownerOneId},not-in-this-scope`,
        columns: "machine",
      }),
    });

    expect(result.state.owner).toEqual([ownerOneId]);
    expect(result.rows.map((row) => row.initials)).toEqual(["AAA", "BBB"]);
  });
});
