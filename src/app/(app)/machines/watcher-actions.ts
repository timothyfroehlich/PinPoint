"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { log } from "~/lib/logger";
import { type Result, ok, err } from "~/lib/result";
import { toggleMachineWatcher } from "~/services/machines";

export type ToggleMachineWatcherResult = Result<
  { isWatching: boolean },
  "UNAUTHORIZED" | "SERVER"
>;

export async function toggleMachineWatcherAction(
  machineId: string
): Promise<ToggleMachineWatcherResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  try {
    const result = await toggleMachineWatcher({ machineId, userId: user.id });

    revalidatePath(`/m/[initials]`, "page");

    return ok(result);
  } catch (error) {
    log.error(
      { error, action: "toggleMachineWatcher" },
      "toggleMachineWatcherAction failed"
    );
    return err("SERVER", "Failed to toggle watcher");
  }
}
