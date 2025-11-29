"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";
import { type Result, ok, err } from "~/lib/result";
import { z } from "zod";

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  inAppEnabled: z.boolean(),
  notifyOnAssigned: z.boolean(),
  notifyOnStatusChange: z.boolean(),
  notifyOnNewComment: z.boolean(),
  notifyOnNewIssue: z.boolean(),
  watchNewIssuesGlobal: z.boolean(),
  autoWatchOwnedMachines: z.boolean(),
});

export type UpdatePreferencesResult = Result<
  { success: boolean },
  "UNAUTHORIZED" | "VALIDATION" | "SERVER"
>;

export async function updateNotificationPreferencesAction(
  _prevState: UpdatePreferencesResult | undefined,
  formData: FormData
): Promise<UpdatePreferencesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "Unauthorized");
  }

  const rawData = {
    emailEnabled: formData.get("emailEnabled") === "on",
    inAppEnabled: formData.get("inAppEnabled") === "on",
    notifyOnAssigned: formData.get("notifyOnAssigned") === "on",
    notifyOnStatusChange: formData.get("notifyOnStatusChange") === "on",
    notifyOnNewComment: formData.get("notifyOnNewComment") === "on",
    notifyOnNewIssue: formData.get("notifyOnNewIssue") === "on",
    watchNewIssuesGlobal: formData.get("watchNewIssuesGlobal") === "on",
    autoWatchOwnedMachines: formData.get("autoWatchOwnedMachines") === "on",
  };

  const validation = updatePreferencesSchema.safeParse(rawData);
  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  try {
    await db
      .insert(notificationPreferences)
      .values({
        userId: user.id,
        ...validation.data,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: validation.data,
      });

    revalidatePath("/settings/notifications");
    return ok({ success: true });
  } catch (error) {
    console.error("updateNotificationPreferencesAction failed", error);
    return err("SERVER", "Failed to update preferences");
  }
}
