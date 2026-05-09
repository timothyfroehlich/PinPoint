"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { serverActionError } from "~/lib/observability/report-error";
import { type Result, ok, err } from "~/lib/result";
import { toggleIssueWatcher } from "~/services/issues";
import { db } from "~/server/db";
import { issues, userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

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
    const userProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });

    if (!checkPermission("issues.watch", getAccessLevel(userProfile?.role))) {
      return err("UNAUTHORIZED", "You do not have permission to watch issues");
    }

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
    return serverActionError(error, "SERVER", "Failed to toggle watcher", {
      action: "toggleWatcher",
    });
  }
}
