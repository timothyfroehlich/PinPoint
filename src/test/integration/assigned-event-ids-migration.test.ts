import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { issues, machines, userProfiles } from "~/server/db/schema";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

const migrationStatements = readFileSync(
  resolve("drizzle/0103_assigned-event-assignee-ids.sql"),
  "utf8"
)
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter((statement) => statement.length > 0);

/**
 * 0103 points Activity's "assigned" events at the assignee's account
 * (PP-0fg0.1): an event whose name exactly one account holds gains that id,
 * anything else gains a null id, and every event keeps its name.
 */
describe("0103 assigned-event assignee ids backfill", () => {
  setupTestDb();

  it("ties unique names to accounts, keeps the rest, and is safe to rerun", async () => {
    const db = await getTestDb();
    const alice = randomUUID();
    const sam1 = randomUUID();
    const sam2 = randomUUID();
    await db
      .insert(userProfiles)
      .values([
        createTestUser({ id: alice, firstName: "Alice", lastName: "Able" }),
        createTestUser({ id: sam1, firstName: "Sam", lastName: "Same" }),
        createTestUser({ id: sam2, firstName: "Sam", lastName: "Same" }),
      ]);
    const machine = createTestMachine();
    await db.insert(machines).values(machine);
    const issue = createTestIssue(machine.initials, { issueNumber: 1 });
    await db.insert(issues).values(issue);

    // Pre-0103 rows are written as raw jsonb: the current type has no
    // name-only shape.
    async function event(eventData: object): Promise<string> {
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO issue_comments (id, issue_id, is_system, event_data)
        VALUES (${id}, ${issue.id}, true, ${JSON.stringify(eventData)}::jsonb)
      `);
      return id;
    }
    const unique = await event({
      type: "assigned",
      assigneeName: "Alice Able",
    });
    const ambiguous = await event({
      type: "assigned",
      assigneeName: "Sam Same",
    });
    const unmatched = await event({
      type: "assigned",
      assigneeName: "Gone Person",
    });
    const current = await event({ type: "assigned", assigneeId: sam1 });
    const other = await event({
      type: "status_changed",
      from: "new",
      to: "confirmed",
    });

    async function eventData(): Promise<Map<string, unknown>> {
      const rows = await db.execute<{ id: string; event_data: unknown }>(
        sql`SELECT id, event_data FROM issue_comments`
      );
      return new Map(rows.rows.map((row) => [row.id, row.event_data]));
    }
    const runMigration = async (): Promise<void> => {
      for (const statement of migrationStatements) {
        await db.execute(sql.raw(statement));
      }
    };

    await runMigration();
    const afterFirst = await eventData();
    // The name stays, so the previous release still renders the event.
    expect(afterFirst.get(unique)).toEqual({
      type: "assigned",
      assigneeId: alice,
      assigneeName: "Alice Able",
    });
    expect(afterFirst.get(ambiguous)).toEqual({
      type: "assigned",
      assigneeId: null,
      assigneeName: "Sam Same",
    });
    expect(afterFirst.get(unmatched)).toEqual({
      type: "assigned",
      assigneeId: null,
      assigneeName: "Gone Person",
    });
    expect(afterFirst.get(current)).toEqual({
      type: "assigned",
      assigneeId: sam1,
    });
    expect(afterFirst.get(other)).toEqual({
      type: "status_changed",
      from: "new",
      to: "confirmed",
    });

    // A later account taking an unmatched name does not claim the event on a
    // rerun: settled rows are never re-matched.
    await db
      .insert(userProfiles)
      .values(createTestUser({ firstName: "Gone", lastName: "Person" }));
    await runMigration();
    expect(await eventData()).toEqual(afterFirst);
  });
});
