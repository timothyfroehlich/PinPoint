"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import {
  toggleMachineWatcher,
  updateMachineWatchMode,
} from "~/services/machines";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

export type ToggleMachineWatcherResult = ProtectedActionResult<
  { isWatching: boolean; watchMode: string },
  "SERVER"
>;

export type UpdateWatchModeResult = ProtectedActionResult<
  { watchMode: string },
  "SERVER" | "VALIDATION"
>;

const toggleMachineWatcherProtected = createProtectedAction({
  actionName: "toggleMachineWatcherAction",
  schema: z.string().uuid(),
  permission: "machines.watch",
  handler: async (machineId, { user }) => {
    const result = await toggleMachineWatcher({ machineId, userId: user.id });

    if (!result.ok) {
      return result;
    }

    await revalidateMachinePath(machineId);

    return result;
  },
});

export async function toggleMachineWatcherAction(
  machineId: string
): Promise<ToggleMachineWatcherResult> {
  return await toggleMachineWatcherProtected(machineId);
}

const updateWatchModeSchema = z.object({
  machineId: z.string().uuid(),
  watchMode: z.enum(["notify", "subscribe"]),
});

const updateMachineWatchModeProtected = createProtectedAction({
  actionName: "updateMachineWatchModeAction",
  schema: updateWatchModeSchema,
  permission: "machines.watch",
  handler: async ({ machineId, watchMode }, { user }) => {
    const result = await updateMachineWatchMode({
      machineId,
      userId: user.id,
      watchMode,
    });

    if (!result.ok) {
      return result;
    }

    await revalidateMachinePath(machineId);

    return result;
  },
});

export async function updateMachineWatchModeAction(
  machineId: string,
  watchMode: "notify" | "subscribe"
): Promise<UpdateWatchModeResult> {
  return await updateMachineWatchModeProtected({ machineId, watchMode });
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
