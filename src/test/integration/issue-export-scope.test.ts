import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import {
  collectionMachines,
  collections,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import type { ExportIssuesResult } from "~/app/(app)/issues/export-action";

// --- boundary mocks -------------------------------------------------------
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const { exportIssuesAction } = await import("~/app/(app)/issues/export-action");

function signIn(userId: string): void {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

/** The Issue ID column of an export, in row order. */
function exportedIds(result: ExportIssuesResult): string[] {
  if (!result.ok) throw new Error(`export failed: ${result.code}`);
  return result.value.csv
    .split("\r\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split(",")[0] ?? "");
}

/**
 * Export from an Issues tab (issues-list §2.2, §5.4): every matching issue
 * within the tab's scope, resolved on the server with the tab's own access
 * checks, never from a machine list the client sends.
 */
describe("exportIssuesAction scope", () => {
  setupTestDb();

  const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let collectionId = "";
  const VIEW_TOKEN = "share-token-for-tests";

  beforeEach(async () => {
    mockGetUser.mockReset();
    const db = await getTestDb();
    await db.insert(userProfiles).values([
      createTestUser({ id: OWNER, firstName: "Olive", lastName: "Owner" }),
      createTestUser({
        id: STRANGER,
        firstName: "Sam",
        lastName: "Stranger",
      }),
    ]);
    const inside = createTestMachine({
      initials: "IN",
      name: "Inside",
      ownerId: OWNER,
      pinballmapExcluded: true,
      manufacturer: "Stern",
    });
    const alsoIn = createTestMachine({
      initials: "AL",
      name: "Also Inside",
      ownerId: OWNER,
      pinballmapExcluded: true,
      manufacturer: "Stern",
    });
    const outside = createTestMachine({
      initials: "OUT",
      name: "Outside",
      ownerId: STRANGER,
      pinballmapExcluded: true,
      manufacturer: "Williams",
    });
    const offFloor = createTestMachine({
      initials: "OFF",
      name: "Off Floor",
      ownerId: STRANGER,
      presenceStatus: "off_the_floor",
    });
    await db.insert(machines).values([inside, alsoIn, outside, offFloor]);
    await db.insert(issues).values([
      createTestIssue("IN", { issueNumber: 1, title: "inside one" }),
      createTestIssue("AL", { issueNumber: 1, title: "also inside" }),
      createTestIssue("OUT", { issueNumber: 1, title: "outside" }),
      createTestIssue("OFF", {
        issueNumber: 1,
        title: "off the floor, fixed",
        status: "fixed",
      }),
    ]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Mine", ownerId: OWNER, viewToken: VIEW_TOKEN })
      .returning();
    if (!collection) throw new Error("collection insert failed");
    collectionId = collection.id;
    await db.insert(collectionMachines).values([
      { collectionId, machineId: inside.id },
      { collectionId, machineId: alsoIn.id },
    ]);
  });

  it("exports only a Collection's issues when its owner opens it by id", async () => {
    signIn(OWNER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: collectionId },
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("narrows within the scope and never widens it with a client machine filter", async () => {
    signIn(OWNER);
    const result = await exportIssuesAction({
      filtersJson: JSON.stringify({ machine: ["IN", "OUT"] }),
      scope: { kind: "collection", handle: collectionId },
    });
    expect(exportedIds(result)).toEqual(["IN-01"]);

    const outsideOnly = await exportIssuesAction({
      filtersJson: JSON.stringify({ machine: ["OUT"] }),
      scope: { kind: "collection", handle: collectionId },
    });
    expect(outsideOnly.ok).toBe(false);
    if (!outsideOnly.ok) expect(outsideOnly.code).toBe("EMPTY");
  });

  it("refuses a Collection id the viewer cannot open, as the tab does", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: collectionId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("exports a shared Collection through its view token", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: VIEW_TOKEN },
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("exports an owner Collection's issues", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "owner", userId: OWNER },
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("exports a Tag's issues", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "tag", type: "manufacturer", slug: "williams" },
    });
    expect(exportedIds(result)).toEqual(["OUT-01"]);
  });

  it("exports every issue on /issues when no scope is named", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({
      filtersJson: JSON.stringify({ sort: "issue_asc" }),
    });
    // Default filters: open statuses on On the Floor machines.
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01", "OUT-01"]);
  });

  it("keeps the machine-page export: every status, whatever the presence", async () => {
    signIn(STRANGER);
    const result = await exportIssuesAction({ machineInitials: "OFF" });
    expect(exportedIds(result)).toEqual(["OFF-01"]);
  });
});
