"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { issueWatchers } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { type Result, ok, err } from "~/lib/result";

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
    // Check if already watching
    const existing = await db.query.issueWatchers.findFirst({
      where: and(
        eq(issueWatchers.issueId, issueId),
        eq(issueWatchers.userId, user.id)
      ),
    });

    if (existing) {
      // Unwatch
      await db
        .delete(issueWatchers)
        .where(
          and(
            eq(issueWatchers.issueId, issueId),
            eq(issueWatchers.userId, user.id)
          )
        );

      revalidatePath(`/issues/${issueId}`);
      return ok({ isWatching: false });
    } else {
      // Watch
      await db.insert(issueWatchers).values({
        issueId,
        userId: user.id,
      });

      revalidatePath(`/issues/${issueId}`);
      return ok({ isWatching: true });
    }
  } catch (error) {
    console.error("toggleWatcherAction failed", error);
    return err("SERVER", "Failed to toggle watcher");
  }
}
