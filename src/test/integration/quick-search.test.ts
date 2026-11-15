import { describe, expect, it, vi } from "vitest";
import { createTestIssue, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, pinballmapCatalog } from "~/server/db/schema";
import {
  listQuickSearchMachines,
  quickSearchQuerySchema,
  searchQuickIssues,
} from "~/app/api/quick-search/queries";
import { QUICK_SEARCH_RESULT_LIMIT } from "~/lib/quick-search/match";
import { plainTextToDoc } from "~/lib/tiptap/types";
import {
  quickSearchIssueResultsSchema,
  quickSearchMachineIndexSchema,
} from "~/lib/quick-search/types";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

describe("quick search queries", () => {
  setupTestDb();

  it("validates and normalizes bounded URL queries", () => {
    expect(quickSearchQuerySchema.parse("  Godzilla   Premium  ")).toBe(
      "Godzilla Premium"
    );
    expect(quickSearchQuerySchema.safeParse("x".repeat(321)).success).toBe(
      false
    );
  });

  it("matches and ranks public issue identity fields", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 101,
      name: "Godzilla Premium",
    });
    await db.insert(machines).values([
      createTestMachine({ initials: "AFM", name: "Attack from Mars" }),
      createTestMachine({ initials: "AF2", name: "AFM Tournament Edition" }),
      createTestMachine({
        initials: "GODZ",
        name: "Big G",
        pinballmapMachineId: 101,
      }),
    ]);
    await db.insert(issues).values([
      createTestIssue("AFM", {
        issueNumber: 3,
        title: "Flipper feels weak",
        status: "fixed",
      }),
      createTestIssue("AFM", {
        issueNumber: 4,
        title: "Flipper sticks after multiball",
        status: "new",
      }),
      createTestIssue("GODZ", {
        issueNumber: 1,
        title: "Unrelated title",
        description: plainTextToDoc("private search decoy"),
        reporterName: "Hidden Search Decoy",
      }),
    ]);

    const issueResults = await searchQuickIssues("flipper");
    expect(quickSearchIssueResultsSchema.safeParse(issueResults).success).toBe(
      true
    );
    expect(issueResults.issues.map((issue) => issue.issueNumber)).toEqual([
      4, 3,
    ]);

    const exactIssueResults = await searchQuickIssues("AFM-03");
    expect(exactIssueResults.issues[0]).toEqual(
      expect.objectContaining({ machineInitials: "AFM", issueNumber: 3 })
    );

    const machineNameResults = await searchQuickIssues("Attack");
    expect(machineNameResults.issues).toHaveLength(2);

    const excludedFieldResults = await searchQuickIssues("search decoy");
    expect(excludedFieldResults.issues).toHaveLength(0);
  });

  it("lists each machine with its current model identity, manufacturer, and year", async () => {
    const db = await getTestDb();
    await db.insert(pinballmapCatalog).values({
      pinballmapMachineId: 991,
      name: "Meteor",
      manufacturer: "Bally",
      year: 1995,
    });
    await db.insert(machines).values([
      createTestMachine({
        initials: "PBM",
        name: "Z Cabinet",
        pinballmapMachineId: 991,
      }),
      createTestMachine({
        initials: "MAN",
        name: "A Cabinet",
        pinballmapExcluded: true,
        modelName: "Prototype",
        manufacturer: "The Bally Company",
        year: 1987,
      }),
      // Neither linked nor uncataloged: its stored copy is not a manufacturer.
      createTestMachine({
        initials: "UND",
        name: "Q Cabinet",
        manufacturer: "Bally",
      }),
    ]);

    const index = await listQuickSearchMachines();
    expect(quickSearchMachineIndexSchema.safeParse(index).success).toBe(true);
    expect(index.machines).toEqual([
      expect.objectContaining({
        initials: "MAN",
        modelName: "Prototype",
        manufacturer: "The Bally Company",
        year: "1987",
      }),
      expect.objectContaining({
        initials: "UND",
        manufacturer: null,
      }),
      expect.objectContaining({
        initials: "PBM",
        modelName: "Meteor",
        manufacturer: "Bally",
        year: "1995",
      }),
    ]);
  });

  it("enforces the minimum query length and result limit for issues", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "MM", name: "Medieval Madness" }));
    await db.insert(issues).values(
      Array.from({ length: QUICK_SEARCH_RESULT_LIMIT + 2 }, (_unused, index) =>
        createTestIssue("MM", {
          issueNumber: index + 1,
          title: `Magnet ${String(index + 1)}`,
        })
      )
    );

    expect(await searchQuickIssues("M")).toEqual({ issues: [] });
    expect((await searchQuickIssues("Magnet")).issues).toHaveLength(
      QUICK_SEARCH_RESULT_LIMIT
    );
  });

  it("leaves out Removed machines and the issues on them", async () => {
    const db = await getTestDb();
    await db.insert(machines).values([
      createTestMachine({ initials: "TZ", name: "Twilight Zone" }),
      createTestMachine({
        initials: "TZ2",
        name: "Twilight Zone Sold",
        presenceStatus: "removed",
      }),
    ]);
    await db
      .insert(issues)
      .values([
        createTestIssue("TZ", { issueNumber: 1, title: "Twilight clock" }),
        createTestIssue("TZ2", { issueNumber: 1, title: "Twilight magnet" }),
      ]);

    expect(
      (await listQuickSearchMachines()).machines.map(
        (machine) => machine.initials
      )
    ).toEqual(["TZ"]);
    expect(
      (await searchQuickIssues("Twilight")).issues.map(
        (issue) => issue.machineInitials
      )
    ).toEqual(["TZ"]);
  });

  it("preserves three-digit issue numbers in identifier matches", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values(createTestMachine({ initials: "AFM", name: "Attack from Mars" }));
    await db
      .insert(issues)
      .values([
        createTestIssue("AFM", { issueNumber: 12, title: "Issue twelve" }),
        createTestIssue("AFM", { issueNumber: 123, title: "Issue 123" }),
      ]);

    expect(
      (await searchQuickIssues("AFM-123")).issues.map(
        (issue) => issue.issueNumber
      )
    ).toEqual([123]);
    expect(
      (await searchQuickIssues("AFM-12")).issues.map(
        (issue) => issue.issueNumber
      )
    ).toEqual([12, 123]);
  });
});
