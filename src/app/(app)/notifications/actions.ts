"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { notifications } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { type Result, ok, err } from "~/lib/result";

export type MarkAsReadResult = Result<
  { success: boolean },
  "UNAUTHORIZED" | "SERVER"
>;

export async function markAsReadAction(
  notificationId: string
): Promise<MarkAsReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, user.id)
        )
      );

    revalidatePath("/", "layout"); // Revalidate everywhere to update notification count
    return ok({ success: true });
  } catch (error) {
    console.error("markAsReadAction failed", error);
    return err("SERVER", "Failed to mark notification as read");
  }
}

export async function markAllAsReadAction(): Promise<MarkAsReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id)));

    revalidatePath("/", "layout");
    return ok({ success: true });
  } catch (error) {
    console.error("markAllAsReadAction failed", error);
    return err("SERVER", "Failed to mark all as read");
  }
}
