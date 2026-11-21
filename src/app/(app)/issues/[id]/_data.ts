import "server-only";

import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

/**
 * Where a legacy id-addressed issue link points: the issue's machine initials
 * and number, or undefined when no issue has this id. The caller validates
 * the id as a uuid first.
 */
export async function getIssueLocation(
  id: string
): Promise<{ machineInitials: string; issueNumber: number } | undefined> {
  return db.query.issues.findFirst({
    where: eq(issues.id, id),
    columns: { machineInitials: true, issueNumber: true },
  });
}
