import "server-only";

import { eq } from "drizzle-orm";

import { err, ok, type Result } from "~/lib/result";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

/** What an issue mutation needs to check ownership and revalidate the page. */
export interface IssueAuthContext {
  machineInitials: string;
  issueNumber: number;
  reportedBy: string | null;
  machineOwnerId: string | null;
}

/**
 * Load the issue fields an ownership permission check reads, plus the machine
 * initials and issue number its page lives at. Fits `createProtectedAction`'s
 * `load` step: a missing issue is `NOT_FOUND`.
 */
export async function getIssueAuthContext(
  issueId: string
): Promise<Result<IssueAuthContext, "NOT_FOUND">> {
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, issueId),
    columns: { machineInitials: true, issueNumber: true, reportedBy: true },
    with: { machine: { columns: { ownerId: true } } },
  });

  if (!issue) {
    return err("NOT_FOUND", "Issue not found");
  }

  return ok({
    machineInitials: issue.machineInitials,
    issueNumber: issue.issueNumber,
    reportedBy: issue.reportedBy,
    machineOwnerId: issue.machine.ownerId,
  });
}
