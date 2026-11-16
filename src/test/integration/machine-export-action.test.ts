import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { signInAs, signOut } from "~/test/helpers/mock-auth";
import {
  collectionMachines,
  collections,
  issues,
  machines,
  pinballmapCatalog,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import type { ExportMachinesResult } from "~/app/(app)/m/export-action";

// --- boundary mocks -------------------------------------------------------
vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));

const { exportMachinesAction } = await import("~/app/(app)/m/export-action");

/** An export's data lines, in row order. */
function exportedLines(result: ExportMachinesResult): string[] {
  if (!result.ok) throw new Error(`export failed: ${result.code}`);
  return result.value.csv.split("\r\n").slice(1, -1);
}

/** The ID column (machine initials) of an export, in row order. */
function exportedIds(result: ExportMachinesResult): string[] {
  return exportedLines(result).map((line) => line.split(",")[0] ?? "");
}

/**
 * Export from a Machines list (machine-views §3.15–§3.17): every machine
 * matching the View Configuration across all pages, within the Surface's
 * scope, in the list's sort order, with the same columns whatever fields the
 * list displays.
 */
describe("exportMachinesAction — PGlite integration (CORE-TEST-004, CORE-TEST-009)", () => {
  setupTestDb();

  const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const VIEW_TOKEN = "share-token-for-tests";
  let collectionId = "";
  const ids = {
    alpha: "11111111-1111-4111-8111-111111111111",
    bravo: "22222222-2222-4222-8222-222222222222",
    charlie: "33333333-3333-4333-8333-333333333333",
    delta: "44444444-4444-4444-8444-444444444444",
  };

  beforeEach(async () => {
    signOut();
    const db = await getTestDb();
    await db.insert(userProfiles).values([
      createTestUser({ id: OWNER, firstName: "Olive", lastName: "Owner" }),
      createTestUser({
        id: STRANGER,
        firstName: "Sam",
        lastName: "Stranger",
      }),
    ]);
    // Alpha is linked to the catalog, whose title carries the edition.
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 502,
      name: "Alpha (Premium)",
      manufacturer: "Stern",
      year: 2015,
    });
    await db.insert(machines).values([
      createTestMachine({
        id: ids.alpha,
        initials: "ALP",
        name: "Alpha",
        ownerId: OWNER,
        pinballmapMachineId: 502,
        createdAt: new Date("2026-03-05T18:00:00.000Z"),
      }),
      createTestMachine({
        id: ids.bravo,
        initials: "BRV",
        name: "Bravo",
        ownerId: STRANGER,
        pinballmapExcluded: true,
        manufacturer: "Williams",
        year: 1995,
      }),
      // No owner, manufacturer, or year: those cells stay empty.
      createTestMachine({
        id: ids.charlie,
        initials: "CHA",
        name: 'Charlie, the "Third"',
      }),
      createTestMachine({
        id: ids.delta,
        initials: "DEL",
        name: "Delta",
        ownerId: OWNER,
        presenceStatus: "off_the_floor",
        pinballmapExcluded: true,
        manufacturer: "Stern",
        year: 2020,
      }),
    ]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Mine", ownerId: OWNER, viewToken: VIEW_TOKEN })
      .returning();
    if (!collection) throw new Error("collection insert failed");
    collectionId = collection.id;
    await db.insert(collectionMachines).values([
      { collectionId, machineId: ids.alpha },
      { collectionId, machineId: ids.charlie },
    ]);
  });

  it("exports the twelve columns, with empty cells for what a machine lacks", async () => {
    const db = await getTestDb();
    await db.insert(issues).values([
      createTestIssue("ALP", { issueNumber: 1, severity: "major" }),
      createTestIssue("ALP", { issueNumber: 2, severity: "minor" }),
      createTestIssue("ALP", {
        issueNumber: 3,
        severity: "unplayable",
        status: "fixed",
      }),
    ]);
    await db.insert(timelineEvents).values([
      {
        machineId: ids.alpha,
        sourceType: "comment",
        tag: "maintenance",
        createdAt: new Date("2026-04-01T15:00:00.000Z"),
      },
      {
        machineId: ids.alpha,
        sourceType: "comment",
        tag: "note",
        createdAt: new Date("2026-04-02T15:00:00.000Z"),
      },
    ]);
    signInAs(STRANGER);
    // Displaying only the Machine field changes nothing about the columns.
    const result = await exportMachinesAction({
      query: "sort=machine&dir=asc&presence=all&columns=machine",
      scope: { kind: "all" },
    });
    if (!result.ok) throw new Error(result.code);

    const lines = result.value.csv.split("\r\n");
    expect(lines[0]).toBe(
      "﻿ID,Name,Model,Manufacturer,Year,Owner,Date Added,Presence,Playability,Open Issues,Last Serviced,Last Activity"
    );
    expect(lines[1]).toBe(
      "ALP,Alpha,Alpha (Premium),Stern,2015,Olive Owner,2026-03-05,On the Floor,Needs Service,2,2026-04-01,2026-04-02"
    );
    // No catalog title, unassigned, no manufacturer, no year, never serviced,
    // no activity.
    expect(lines[3]).toMatch(
      /^CHA,"Charlie, the ""Third""",,,,,\d{4}-\d{2}-\d{2},On the Floor,Operational,0,,$/
    );
  });

  it("exports every matching machine across all pages, ignoring the page size", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      query: "sort=machine&dir=asc&presence=all&pageSize=1&page=3",
      scope: { kind: "all" },
    });
    expect(exportedIds(result)).toEqual(["ALP", "BRV", "CHA", "DEL"]);
  });

  it("follows the list's filters and sort order", async () => {
    signInAs(STRANGER);
    const onFloor = await exportMachinesAction({
      query: "sort=machine&dir=desc",
      scope: { kind: "all" },
    });
    // The Machines page preset shows machines on the floor.
    expect(exportedIds(onFloor)).toEqual(["CHA", "BRV", "ALP"]);

    const searched = await exportMachinesAction({
      query: "q=stern&presence=all&sort=machine&dir=asc",
      scope: { kind: "all" },
    });
    expect(exportedIds(searched)).toEqual(["ALP", "DEL"]);
  });

  it("resolves the Owner filter's me to the signed-in viewer, as the list does", async () => {
    signInAs(OWNER);
    const result = await exportMachinesAction({
      query: "owner=me&presence=all&sort=machine&dir=asc",
      scope: { kind: "all" },
    });
    expect(exportedIds(result)).toEqual(["ALP", "DEL"]);
  });

  it("sorts by Last serviced when it is not a displayed field", async () => {
    const db = await getTestDb();
    await db.insert(timelineEvents).values([
      {
        machineId: ids.alpha,
        sourceType: "comment",
        tag: "maintenance",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        machineId: ids.bravo,
        sourceType: "comment",
        tag: "maintenance",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ]);
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      query: "sort=lastServiced&dir=desc&presence=all&columns=machine",
      scope: { kind: "all" },
    });
    expect(exportedIds(result).slice(0, 2)).toEqual(["BRV", "ALP"]);
  });

  it("exports only a Collection's machines when its owner opens it by id", async () => {
    signInAs(OWNER);
    const result = await exportMachinesAction({
      query: "sort=machine&dir=asc",
      scope: { kind: "collection", handle: collectionId },
    });
    expect(exportedIds(result)).toEqual(["ALP", "CHA"]);
  });

  it("refuses a Collection id the viewer cannot open, as the tab does", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      scope: { kind: "collection", handle: collectionId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("exports a shared Collection through its view token", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      query: "sort=machine&dir=asc",
      scope: { kind: "collection", handle: VIEW_TOKEN },
    });
    expect(exportedIds(result)).toEqual(["ALP", "CHA"]);
  });

  it("exports a Tag's machines", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      query: "sort=machine&dir=asc&presence=all",
      scope: { kind: "tag", type: "manufacturer", slug: "stern" },
    });
    expect(exportedIds(result)).toEqual(["ALP", "DEL"]);
  });

  it("returns NOT_FOUND for a Tag that does not exist", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({
      scope: { kind: "tag", type: "manufacturer", slug: "no-such-maker" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("names the file pinpoint-machines-YYYY-MM-DD.csv", async () => {
    signInAs(STRANGER);
    const result = await exportMachinesAction({ scope: { kind: "all" } });
    if (!result.ok) throw new Error(result.code);
    expect(result.value.fileName).toMatch(
      /^pinpoint-machines-\d{4}-\d{2}-\d{2}\.csv$/
    );
  });

  describe("authentication, validation, and empty results", () => {
    it("rejects anonymous viewers with UNAUTHORIZED", async () => {
      signOut();
      const result = await exportMachinesAction({ scope: { kind: "all" } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("UNAUTHORIZED");
    });

    it("returns VALIDATION for an oversized query", async () => {
      signInAs(STRANGER);
      const result = await exportMachinesAction({
        query: `q=${"x".repeat(4000)}`,
        scope: { kind: "all" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION");
    });

    it("returns VALIDATION for an unknown scope", async () => {
      signInAs(STRANGER);
      const result = await exportMachinesAction({
        // @ts-expect-error -- exercising the server-side schema
        scope: { kind: "everything" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("VALIDATION");
    });

    it("returns EMPTY when nothing matches", async () => {
      signInAs(STRANGER);
      const result = await exportMachinesAction({
        query: "q=nonexistent-query-string",
        scope: { kind: "all" },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("EMPTY");
    });
  });
});
