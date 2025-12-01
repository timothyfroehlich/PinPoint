"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import { toggleIssueWatcher } from "~/lib/issues/mutations";

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
    revalidatePath(`/issues/${issueId}`);
    return ok(result);
  } catch (error) {
    log.error({ error, action: "toggleWatcher" }, "toggleWatcherAction failed");
    return err("SERVER", "Failed to toggle watcher");
  }
}
