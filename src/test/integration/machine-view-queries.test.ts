import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
  invitedUsers,
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
    expect(all.rows.every((row) => row.lastServicedAt === undefined)).toBe(
      true
    );
    expect(all.rows.every((row) => !Object.hasOwn(row, "ownerId"))).toBe(true);
  });

  it("sends the identity line's manufacturer, year, and owner name whatever fields are displayed (§3.2, §3.3)", async () => {
    const db = await getTestDb();
    await db.insert(machines).values(
      createTestMachine({
        initials: "DDD",
        name: "Delta",
        ownerId: null,
        year: null,
      })
    );

    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "all" },
      preset: "machines",
      searchParams: new URLSearchParams({
        presence: "all",
        columns: "machine",
      }),
    });

    const byInitials = new Map(result.rows.map((row) => [row.initials, row]));
    expect(byInitials.get("AAA")).toMatchObject({
      ownerName: "Owner One",
      hasOwner: true,
    });
    expect(byInitials.get("DDD")).toMatchObject({
      manufacturer: "Unknown",
      year: null,
      ownerName: "Unassigned",
      hasOwner: false,
    });
    // Names only; an owner's email never reaches the client (CORE-SEC-007).
    expect(JSON.stringify(result.rows)).not.toContain("@");
  });

  it("sends health on every row for the phone Compact row, whatever fields are displayed (§5.3)", async () => {
    const db = await getTestDb();
    await db
      .insert(issues)
      .values([
        createTestIssue("AAA", { issueNumber: 1, severity: "unplayable" }),
        createTestIssue("CCC", { issueNumber: 1, severity: "minor" }),
      ]);

    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "all" },
      preset: "machines",
      searchParams: new URLSearchParams({
        presence: "all",
        columns: "machine",
      }),
    });

    expect(result.summary.playability.byStatus.unplayable).toBe(1);
    expect(
      result.rows.map((row) => [
        row.initials,
        row.health?.playability,
        row.health?.openIssues,
        row.health?.worstSeverity,
      ])
    ).toEqual([
      ["AAA", "unplayable", 1, "unplayable"],
      ["BBB", "operational", 0, null],
      ["CCC", "operational", 1, "minor"],
    ]);
  });

  it("counts Summary Widgets over the whole scope, whatever the filters, without Removed machines", async () => {
    const db = await getTestDb();
    await db
      .update(machines)
      .set({ presenceStatus: "removed" })
      .where(eq(machines.id, gammaId));
    await db
      .update(machines)
      .set({ presenceStatus: "on_loan" })
      .where(eq(machines.id, betaId));
    await db
      .insert(issues)
      .values([
        createTestIssue("AAA", { issueNumber: 1, severity: "unplayable" }),
      ]);
    // Search and filters that match nothing never change the counts
    // (widgets §3.1).
    const searchParams = new URLSearchParams({
      q: "no such machine",
      presence: "off_the_floor",
      status: "operational",
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

    expect(all.totalCount).toBe(0);
    // Gamma is Removed: not counted, not in the headline total.
    expect(all.summary.presence).toEqual({
      total: 2,
      byPresence: {
        on_the_floor: 1,
        off_the_floor: 0,
        on_loan: 1,
        pending_arrival: 0,
      },
    });
    expect(all.summary.playability).toEqual({
      onTheFloor: 1,
      byStatus: { operational: 0, needs_service: 0, unplayable: 1 },
    });
    // The Collection tab holds Alpha and Gamma: only its own scope counts.
    expect(collection.summary.presence.total).toBe(1);
    expect(collection.summary.presence.byPresence.on_the_floor).toBe(1);
    expect(collection.summary.playability.onTheFloor).toBe(1);
  });

  it("keeps an owner with no machines in the scope, matching nothing (list-views §10.18)", async () => {
    const db = await getTestDb();
    const invitedId = randomUUID();
    await db.insert(invitedUsers).values({
      id: invitedId,
      firstName: "Invited",
      lastName: "Owner",
      email: `invited-${invitedId}@example.com`,
      role: "member",
    });

    // Owner Two's only machine is outside Owner One's Collection, and the
    // invited person and Unassigned own nothing at all.
    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "owner", ownerId: ownerOneId },
      preset: "collection",
      searchParams: new URLSearchParams({
        owner: `${ownerTwoId},${invitedId},unassigned`,
        columns: "machine",
      }),
    });

    expect(result.state.owner).toEqual([ownerTwoId, invitedId, "unassigned"]);
    expect(result.rows).toEqual([]);
    expect(result.totalCount).toBe(0);
    // The scope still bounds the tab; the filter never widens it.
    expect(result.scopeCount).toBe(2);
    expect(result.ownerOptions).toEqual([
      { id: invitedId, name: "Invited Owner" },
      { id: ownerOneId, name: "Owner One" },
      { id: ownerTwoId, name: "Owner Two" },
      { id: "unassigned", name: "Unassigned" },
    ]);
    expect(
      result.ownerOptions.some((option) => Object.hasOwn(option, "email"))
    ).toBe(false);
  });

  it("narrows a Collection tab to an in-scope owner alongside an out-of-scope one", async () => {
    const db = await getTestDb();
    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "collection", collectionId },
      preset: "collection",
      searchParams: new URLSearchParams({
        owner: `${ownerOneId},${ownerTwoId}`,
        columns: "machine",
      }),
    });

    expect(result.state.owner).toEqual([ownerOneId, ownerTwoId]);
    // Beta belongs to Owner One but is outside the Collection.
    expect(result.rows.map((row) => row.initials)).toEqual(["AAA", "CCC"]);
  });

  it("drops owner values that name no one (list-views §10.14)", async () => {
    const db = await getTestDb();
    const result = await loadMachineViewFromDatabase(asDbOrTx(db), {
      scope: { kind: "owner", ownerId: ownerOneId },
      preset: "collection",
      searchParams: new URLSearchParams({
        owner: `${ownerOneId},${randomUUID()},not-a-person`,
        columns: "machine",
      }),
    });

    expect(result.state.owner).toEqual([ownerOneId]);
    expect(result.rows.map((row) => row.initials)).toEqual(["AAA", "BBB"]);
    expect(result.ownerOptions).toEqual([
      { id: ownerOneId, name: "Owner One" },
    ]);
  });
});
