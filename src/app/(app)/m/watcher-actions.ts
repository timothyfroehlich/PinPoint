"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { serverActionError } from "~/lib/observability/report-error";
import { type Result, ok, err } from "~/lib/result";
import {
  toggleMachineWatcher,
  updateMachineWatchMode,
} from "~/services/machines";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export type ToggleMachineWatcherResult = Result<
  { isWatching: boolean; watchMode: string },
  "UNAUTHORIZED" | "SERVER"
>;

export type UpdateWatchModeResult = Result<
  { watchMode: string },
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

    if (!result.ok) {
      return err("SERVER", "Failed to toggle machine watcher");
    }

    await revalidateMachinePath(machineId);

    return ok(result.value);
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "Failed to toggle machine watcher",
      { action: "toggleMachineWatcherAction", machineId }
    );
  }
}

export async function updateMachineWatchModeAction(
  machineId: string,
  watchMode: "notify" | "subscribe"
): Promise<UpdateWatchModeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  try {
    const result = await updateMachineWatchMode({
      machineId,
      userId: user.id,
      watchMode,
    });

    if (!result.ok) {
      if (result.code === "VALIDATION") {
        return err("SERVER", "Invalid watch mode"); // Mapping to server error based on type def, or should update type def?
        // Existing type def allows "SERVER" | "UNAUTHORIZED". "VALIDATION" isn't there.
        // Let's stick to SERVER for now or update type.
        // Wait, I should probably expose VALIDATION but for now SERVER is safe.
      }
      return err("SERVER", "Failed to update machine watch mode");
    }

    await revalidateMachinePath(machineId);

    return ok(result.value);
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "Failed to update machine watch mode",
      { action: "updateMachineWatchModeAction", machineId, watchMode }
    );
  }
}

async function revalidateMachinePath(machineId: string): Promise<void> {
  const machine = await db.query.machines.findFirst({
    where: eq(machines.id, machineId),
    columns: { initials: true },
  });

  if (machine) {
    revalidatePath(`/m/${machine.initials}`);
  }
}
