/**
 * Inserting seed helpers for PGlite integration tests.
 *
 * Each helper builds a row from the matching factory in `factories.ts`,
 * inserts it through the worker-scoped test database (`getTestDb()`), and
 * returns the inserted row. Call them inside a test or hook in a file that
 * runs `setupTestDb()`, which empties the tables after each test.
 *
 * Use the factories directly when a test needs the object without inserting
 * it, or inserts it through the code under test.
 */

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { authUsers, issues, machines, userProfiles } from "~/server/db/schema";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import { getTestDb } from "~/test/setup/pglite";

type UserProfileRow = InferSelectModel<typeof userProfiles>;
type MachineRow = InferSelectModel<typeof machines>;
type IssueRow = InferSelectModel<typeof issues>;

/**
 * Insert a user profile and, like a real sign-up, its `auth.users` row (same
 * id and email). Pass `{ authUser: false }` for a profile without one.
 */
export async function seedUser(
  overrides?: Partial<InferInsertModel<typeof userProfiles>>,
  options: { authUser?: boolean } = {}
): Promise<UserProfileRow> {
  const db = await getTestDb();
  const values = createTestUser(overrides);
  if (options.authUser ?? true) {
    await db.insert(authUsers).values({ id: values.id, email: values.email });
  }
  const [row] = await db.insert(userProfiles).values(values).returning();
  if (!row) throw new Error("seedUser: insert returned no row");
  return row;
}

/**
 * Insert a machine. Without `initials`, a unique value is generated so several
 * seeded machines never collide on the unique index.
 */
export async function seedMachine(
  overrides?: Partial<InferInsertModel<typeof machines>>
): Promise<MachineRow> {
  const db = await getTestDb();
  const values = createTestMachine({
    initials: `T${randomUUID().slice(0, 5).toUpperCase()}`,
    ...overrides,
  });
  const [row] = await db.insert(machines).values(values).returning();
  if (!row) throw new Error("seedMachine: insert returned no row");
  return row;
}

/**
 * Insert an issue on `machineInitials`. Without `issueNumber`, the number is
 * reserved from the machine's `nextIssueNumber` the way the issues service
 * does, so a later issue created through the service does not collide.
 */
export async function seedIssue(
  machineInitials: string,
  overrides?: Partial<InferInsertModel<typeof issues>>
): Promise<IssueRow> {
  const db = await getTestDb();
  let issueNumber = overrides?.issueNumber;
  if (issueNumber === undefined) {
    const [reserved] = await db
      .update(machines)
      .set({ nextIssueNumber: sql`${machines.nextIssueNumber} + 1` })
      .where(eq(machines.initials, machineInitials))
      .returning({ nextIssueNumber: machines.nextIssueNumber });
    if (!reserved) {
      throw new Error(`seedIssue: no machine with initials ${machineInitials}`);
    }
    issueNumber = reserved.nextIssueNumber - 1;
  }
  const values = createTestIssue(machineInitials, {
    ...overrides,
    issueNumber,
  });
  const [row] = await db.insert(issues).values(values).returning();
  if (!row) throw new Error("seedIssue: insert returned no row");
  return row;
}
