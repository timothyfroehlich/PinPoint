"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import { toggleIssueWatcher } from "~/services/issues";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export type ToggleWatcherResult = Result<
  { isWatching: boolean },
  "UNAUTHORIZED" | "SERVER"
>;

export async function toggleWatcherAction(
  issueId: string
): Promise<ToggleWatcherResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  try {
    const result = await toggleIssueWatcher({ issueId, userId: user.id });

    const issue = await db.query.issues.findFirst({
      where: eq(issues.id, issueId),
      columns: { machineInitials: true, issueNumber: true },
    });

    if (issue) {
      revalidatePath(`/m/${issue.machineInitials}/i/${issue.issueNumber}`);
    }

    return ok(result);
  } catch (error) {
    log.error({ error, action: "toggleWatcher" }, "toggleWatcherAction failed");
    return err("SERVER", "Failed to toggle watcher");
  }
}
