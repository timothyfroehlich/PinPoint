import { describe, expect, it } from "vitest";
import { and } from "drizzle-orm";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { issues, machines, userProfiles } from "~/server/db/schema";
import { buildWhereConditions } from "~/lib/issues/filters-queries";

describe("collection issues scoping (PP-slrd.1)", () => {
  setupTestDb();

  it("scoped machine filter returns only collection machines' issues", async () => {
    const db = await getTestDb();
    const owner = createTestUser();
    await db.insert(userProfiles).values(owner);
    const mine = createTestMachine({
      initials: "AA",
      name: "Mine",
      ownerId: owner.id,
    });
    const theirs = createTestMachine({ initials: "BB", name: "Theirs" });
    await db.insert(machines).values([mine, theirs]);
    await db
      .insert(issues)
      .values([
        createTestIssue("AA", { title: "mine issue" }),
        createTestIssue("BB", { title: "theirs issue" }),
      ]);

    const where = buildWhereConditions({ machine: ["AA"] }, asDbOrTx(db));
    const rows = await db.query.issues.findMany({ where: and(...where) });
    expect(rows.map((r) => r.title)).toEqual(["mine issue"]);
  });

  it("bounds the issues to a scope, and an empty scope to nothing (issues-list §2.2)", async () => {
    const db = await getTestDb();
    await db
      .insert(machines)
      .values([
        createTestMachine({ initials: "CC", name: "Mine2" }),
        createTestMachine({ initials: "DD", name: "Other" }),
      ]);
    await db
      .insert(issues)
      .values([
        createTestIssue("CC", { title: "in scope" }),
        createTestIssue("DD", { title: "outside" }),
      ]);
    const titles = async (
      machine: string[] | undefined,
      scope: string[]
    ): Promise<string[]> => {
      const where = buildWhereConditions({ machine }, asDbOrTx(db), { scope });
      const rows = await db.query.issues.findMany({ where: and(...where) });
      return rows.map((r) => r.title);
    };

    expect(await titles(undefined, ["CC"])).toEqual(["in scope"]);
    // A Machine filter outside the scope never widens it.
    expect(await titles(["DD"], ["CC"])).toEqual([]);
    // A group with no machines shows no issues, not every issue.
    expect(await titles(undefined, [])).toEqual([]);
  });
});
