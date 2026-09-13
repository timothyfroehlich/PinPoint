"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { ok } from "~/lib/result";
import { db } from "~/server/db";
import { notifications } from "~/server/db/schema";

export type MarkAsReadResult = ProtectedActionResult<{ success: boolean }>;

const markAsRead = createProtectedAction({
  actionName: "markAsReadAction",
  schema: z.string().uuid(),
  permission: "notifications.manage_own",
  handler: async (notificationId, { user }) => {
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        )
      );

    revalidatePath("/", "layout"); // Revalidate everywhere to update notification count
    return ok({ success: true });
  },
});

export async function markAsReadAction(
  notificationId: string
): Promise<MarkAsReadResult> {
  return await markAsRead(notificationId);
}

const markAllAsRead = createProtectedAction({
  actionName: "markAllAsReadAction",
  permission: "notifications.manage_own",
  handler: async (_input: undefined, { user }) => {
    await db
      .delete(notifications)
      .where(and(eq(notifications.userId, user.id)));

    revalidatePath("/", "layout");
    return ok({ success: true });
  },
});

export async function markAllAsReadAction(): Promise<MarkAsReadResult> {
  return await markAllAsRead(undefined);
}
