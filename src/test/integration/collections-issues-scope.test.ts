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

  it("documents the hazard: an empty machine[] does NOT scope", async () => {
    const db = await getTestDb();
    const mine = createTestMachine({ initials: "CC", name: "Mine2" });
    await db.insert(machines).values(mine);
    await db.insert(issues).values(createTestIssue("CC", { title: "visible" }));

    const where = buildWhereConditions({ machine: [] }, asDbOrTx(db));
    const rows = await db.query.issues.findMany({ where: and(...where) });
    // Unscoped! The collection issues page must short-circuit to its empty
    // state instead of ever passing machine: [] to buildWhereConditions.
    expect(rows.length).toBeGreaterThan(0);
  });
});
