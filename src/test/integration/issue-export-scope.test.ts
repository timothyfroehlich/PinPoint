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
  invitedUsers,
  issues,
  issueWatchers,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { plainTextToDoc } from "~/lib/tiptap/types";
import type { ExportIssuesResult } from "~/app/(app)/issues/export-action";

// --- boundary mocks -------------------------------------------------------
vi.mock("~/lib/supabase/server", () => import("~/test/helpers/mock-auth"));

const { exportIssuesAction } = await import("~/app/(app)/issues/export-action");

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
describe("exportIssuesAction — PGlite integration (CORE-TEST-004, CORE-TEST-009)", () => {
  setupTestDb();

  const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const STRANGER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const GUEST = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  let collectionId = "";
  const VIEW_TOKEN = "share-token-for-tests";

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
    await db.insert(invitedUsers).values([
      {
        id: GUEST,
        firstName: "Guest",
        lastName: "Bob",
        email: "guest-bob@test.com",
        role: "guest",
      },
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
    const [insideIssue] = await db
      .insert(issues)
      .values([
        createTestIssue("IN", {
          issueNumber: 1,
          title: "inside one",
          description: plainTextToDoc("Detailed issue description"),
          status: "new",
          severity: "major",
          priority: "high",
          frequency: "constant",
          reportedBy: OWNER,
          assignedTo: STRANGER,
          createdAt: new Date("2026-01-10T12:00:00Z"),
          updatedAt: new Date("2026-01-15T12:00:00Z"),
        }),
        createTestIssue("AL", {
          issueNumber: 1,
          title: "also inside",
          invitedReportedBy: GUEST,
          createdAt: new Date("2026-01-20T00:00:00Z"),
        }),
        createTestIssue("OUT", {
          issueNumber: 1,
          title: "outside",
          reportedBy: null,
          invitedReportedBy: null,
          createdAt: new Date("2026-01-05T00:00:00Z"),
        }),
        createTestIssue("OFF", {
          issueNumber: 1,
          title: "off the floor, fixed",
          status: "fixed",
        }),
      ])
      .returning();

    if (insideIssue) {
      await db.insert(issueWatchers).values([
        {
          issueId: insideIssue.id,
          userId: STRANGER,
        },
      ]);
    }
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
    signInAs(OWNER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: collectionId },
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("narrows within the scope and never widens it with a client machine filter", async () => {
    signInAs(OWNER);
    const result = await exportIssuesAction({
      query: "machine=IN,OUT",
      scope: { kind: "collection", handle: collectionId },
    });
    expect(exportedIds(result)).toEqual(["IN-01"]);

    const outsideOnly = await exportIssuesAction({
      query: "machine=OUT",
      scope: { kind: "collection", handle: collectionId },
    });
    expect(outsideOnly.ok).toBe(false);
    if (!outsideOnly.ok) expect(outsideOnly.code).toBe("EMPTY");
  });

  it("refuses a Collection id the viewer cannot open, as the tab does", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: collectionId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("exports a shared Collection through its view token", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "collection", handle: VIEW_TOKEN },
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("exports a person's machines' issues through the Machine owner filter (collections-and-tags 6.4)", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({
      query: `owner=${OWNER}&sort=id&dir=asc`,
    });
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01"]);
  });

  it("exports a Tag's issues", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({
      scope: { kind: "tag", type: "manufacturer", slug: "williams" },
    });
    expect(exportedIds(result)).toEqual(["OUT-01"]);
  });

  it("exports every issue on /issues when no scope is named", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({
      query: "sort=id&dir=asc",
    });
    // Default filters: open statuses on On the Floor machines.
    expect(exportedIds(result)).toEqual(["AL-01", "IN-01", "OUT-01"]);
  });

  it("keeps the machine-page export: every status, whatever the presence", async () => {
    signInAs(STRANGER);
    const result = await exportIssuesAction({ machineInitials: "OFF" });
    expect(exportedIds(result)).toEqual(["OFF-01"]);
  });

  // ---------------------------------------------------------------------------
  // Authentication & Validation
  // ---------------------------------------------------------------------------
  describe("authentication and validation", () => {
    it("returns UNAUTHORIZED when user is not signed in", async () => {
      signOut();

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns VALIDATION for invalid machineInitials", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({ machineInitials: "AB@CD" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("returns VALIDATION for an oversized query", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({
        query: `q=${"x".repeat(4000)}`,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("ignores invalid values as the list does, never widening the export (list-views §9.3)", async () => {
      signInAs(STRANGER);

      const invalid = await exportIssuesAction({
        query: "status=invalid-status&presence=nowhere&sort=id&dir=asc",
      });
      const preset = await exportIssuesAction({ query: "sort=id&dir=asc" });

      // An invalid status or presence keeps the Page Preset's Open issues on
      // On the Floor machines, exactly as the list shows them.
      expect(exportedIds(invalid)).toEqual(exportedIds(preset));
    });
  });

  // ---------------------------------------------------------------------------
  // Empty results
  // ---------------------------------------------------------------------------
  describe("empty results", () => {
    it("returns EMPTY when no issues match filters", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({
        query: "q=nonexistent-query-string",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("EMPTY");
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CSV Output and Filenames
  // ---------------------------------------------------------------------------
  describe("CSV output and formatting", () => {
    it("produces correct headers in order", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const firstLine = result.value.csv.split("\r\n")[0];
      expect(firstLine).toBe(
        "\uFEFFIssue ID,Machine,Title,Description,Status,Severity,Priority,Frequency,Reporter,Assigned To,Created,Updated,Closed"
      );
    });

    it("formats general export filename as pinpoint-issues-YYYY-MM-DD.csv", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({});

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("formats machine export filename with machine initials", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({ machineInitials: "IN" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.fileName).toMatch(
        /^pinpoint-IN-issues-\d{4}-\d{2}-\d{2}\.csv$/
      );
    });

    it("formats reporters correctly: user name, invited name, and Anonymous", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({
        query: "sort=id&dir=asc",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // IN-01 has reportedBy: OWNER (Olive Owner)
      expect(result.value.csv).toContain("Olive Owner");
      // AL-01 has invitedReportedBy: GUEST (Guest Bob)
      expect(result.value.csv).toContain("Guest Bob");
      // OUT-01 has no reporter
      expect(result.value.csv).toContain("Anonymous");
    });

    it("maps row values to correct columns", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({ machineInitials: "IN" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const lines = result.value.csv.split("\r\n");
      const dataCols = lines[1]?.split(",") ?? [];

      expect(dataCols[0]).toBe("IN-01");
      expect(dataCols[1]).toBe("Inside");
      expect(dataCols[2]).toBe("inside one");
      expect(dataCols[3]).toBe("Detailed issue description");
      expect(dataCols[4]).toBe("New");
      expect(dataCols[5]).toBe("Major");
      expect(dataCols[6]).toBe("High");
      expect(dataCols[7]).toBe("Constant");
      expect(dataCols[8]).toBe("Olive Owner");
      expect(dataCols[9]).toBe("Sam Stranger");
      expect(dataCols[10]).toBe("2026-01-10");
      expect(dataCols[11]).toBe("2026-01-15");
      expect(dataCols[12]).toBe("");
    });
  });

  // ---------------------------------------------------------------------------
  // Filter parsing & coercion
  // ---------------------------------------------------------------------------
  describe("filter parsing", () => {
    it("reads a Created range from the query (issues-list §4.8)", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({
        query: "created=2026-01-15..",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Only AL-01 was created on 2026-01-20 (after 2026-01-15)
      expect(exportedIds(result)).toEqual(["AL-01"]);
    });

    it("filters by watched issues for the signed-in user", async () => {
      signInAs(STRANGER);

      const result = await exportIssuesAction({
        query: "watching=true&sort=id&dir=asc",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // STRANGER only watches IN-01, so only IN-01 is returned
      expect(exportedIds(result)).toEqual(["IN-01"]);
    });
  });

  // ---------------------------------------------------------------------------
  // Server error handling
  // ---------------------------------------------------------------------------
  describe("server errors", () => {
    it("returns SERVER error when database query throws", async () => {
      signInAs(STRANGER);
      const db = await getTestDb();
      const spy = vi
        .spyOn(db.query.issues, "findMany")
        .mockRejectedValueOnce(new Error("Database connection failure"));

      try {
        const result = await exportIssuesAction({});

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("SERVER");
        }
      } finally {
        spy.mockRestore();
      }
    });

    it("returns SERVER error when a scope loader throws", async () => {
      signInAs(STRANGER);
      const exportScope = await import("~/app/(app)/issues/export-scope");
      const spy = vi
        .spyOn(exportScope, "resolveExportScopeInitials")
        .mockRejectedValueOnce(new Error("Scope loader crashed"));

      try {
        const result = await exportIssuesAction({
          scope: { kind: "tag", type: "manufacturer", slug: "williams" },
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.code).toBe("SERVER");
        }
      } finally {
        spy.mockRestore();
      }
    });
  });
});
