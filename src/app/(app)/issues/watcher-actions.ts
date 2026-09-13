"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { ok } from "~/lib/result";
import { toggleIssueWatcher } from "~/services/issues";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

export type ToggleWatcherResult = ProtectedActionResult<{
  isWatching: boolean;
}>;

const toggleWatcher = createProtectedAction({
  actionName: "toggleWatcherAction",
  schema: z.string().uuid(),
  permission: "issues.watch",
  handler: async (issueId, { user }) => {
    const result = await toggleIssueWatcher({ issueId, userId: user.id });

    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { machineInitials: true, issueNumber: true },
    });

    if (issue) {
      revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    }

    return ok(result);
  },
});

export async function toggleWatcherAction(
  issueId: string
): Promise<ToggleWatcherResult> {
  return await toggleWatcher(issueId);
}
