import { eq, and } from "drizzle-orm";
import { db } from "~/server/db";
import { machineWatchers } from "~/server/db/schema";

/**
 * Toggle watcher status for a user on a machine
 */
export async function toggleMachineWatcher({
  machineId,
  userId,
}: {
  machineId: string;
  userId: string;
}): Promise<{ isWatching: boolean }> {
  // Check if already watching
  const existing = await db.query.machineWatchers.findFirst({
    where: and(
      eq(machineWatchers.machineId, machineId),
      eq(machineWatchers.userId, userId)
    ),
  });

  if (existing) {
    // Unwatch
    await db
      .delete(machineWatchers)
      .where(
        and(
          eq(machineWatchers.machineId, machineId),
          eq(machineWatchers.userId, userId)
        )
      );
    return { isWatching: false };
  } else {
    // Watch
    await db.insert(machineWatchers).values({
      machineId,
      userId,
    });
    return { isWatching: true };
  }
}
