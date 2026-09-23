import { describe, expect, it, vi } from "vitest";
import { createTestIssue, createTestMachine } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { issues, machines, pinballmapCatalog } from "~/server/db/schema";
import {
  QUICK_SEARCH_RESULT_LIMIT,
  quickSearchQuerySchema,
  searchQuickNavigation,
} from "~/app/api/quick-search/queries";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { quickSearchResultsSchema } from "~/lib/quick-search/types";

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

  it("matches and ranks public machine and issue identity fields", async () => {
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

    const initialsResults = await searchQuickNavigation("AFM");
    expect(quickSearchResultsSchema.safeParse(initialsResults).success).toBe(
      true
    );
    expect(initialsResults.machines.map((machine) => machine.initials)).toEqual(
      ["AFM", "AF2"]
    );

    const modelResults = await searchQuickNavigation("Godzilla Premium");
    expect(modelResults.machines).toEqual([
      expect.objectContaining({
        initials: "GODZ",
        modelName: "Godzilla Premium",
      }),
    ]);

    const issueResults = await searchQuickNavigation("flipper");
    expect(issueResults.issues.map((issue) => issue.issueNumber)).toEqual([
      4, 3,
    ]);

    const exactIssueResults = await searchQuickNavigation("AFM-03");
    expect(exactIssueResults.issues[0]).toEqual(
      expect.objectContaining({ machineInitials: "AFM", issueNumber: 3 })
    );

    const machineNameResults = await searchQuickNavigation("Attack");
    expect(machineNameResults.issues).toHaveLength(2);

    const excludedFieldResults = await searchQuickNavigation("search decoy");
    expect(excludedFieldResults.issues).toHaveLength(0);
  });

  it("enforces the minimum query length and per-group result limit", async () => {
    const db = await getTestDb();
    await db.insert(machines).values(
      Array.from({ length: QUICK_SEARCH_RESULT_LIMIT + 2 }, (_unused, index) =>
        createTestMachine({
          initials: `M${String(index + 10)}`,
          name: `Machine ${String(index + 1)}`,
        })
      )
    );

    expect(await searchQuickNavigation("M")).toEqual({
      machines: [],
      issues: [],
    });
    expect((await searchQuickNavigation("Machine")).machines).toHaveLength(
      QUICK_SEARCH_RESULT_LIMIT
    );
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
      (await searchQuickNavigation("AFM-123")).issues.map(
        (issue) => issue.issueNumber
      )
    ).toEqual([123]);
    expect(
      (await searchQuickNavigation("AFM-12")).issues.map(
        (issue) => issue.issueNumber
      )
    ).toEqual([12, 123]);
  });
});
