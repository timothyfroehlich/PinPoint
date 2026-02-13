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
  suppressOwnActions: z.boolean(),

  // Granular Preferences
  emailNotifyOnAssigned: z.boolean(),
  inAppNotifyOnAssigned: z.boolean(),
  emailNotifyOnStatusChange: z.boolean(),
  inAppNotifyOnStatusChange: z.boolean(),
  emailNotifyOnNewComment: z.boolean(),
  inAppNotifyOnNewComment: z.boolean(),
  emailNotifyOnNewIssue: z.boolean(),
  inAppNotifyOnNewIssue: z.boolean(),

  emailWatchNewIssuesGlobal: z.boolean(),
  inAppWatchNewIssuesGlobal: z.boolean(),
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
    suppressOwnActions: formData.get("suppressOwnActions") === "on",

    // Granular Preferences
    emailNotifyOnAssigned: formData.get("emailNotifyOnAssigned") === "on",
    inAppNotifyOnAssigned: formData.get("inAppNotifyOnAssigned") === "on",
    emailNotifyOnStatusChange:
      formData.get("emailNotifyOnStatusChange") === "on",
    inAppNotifyOnStatusChange:
      formData.get("inAppNotifyOnStatusChange") === "on",
    emailNotifyOnNewComment: formData.get("emailNotifyOnNewComment") === "on",
    inAppNotifyOnNewComment: formData.get("inAppNotifyOnNewComment") === "on",
    emailNotifyOnNewIssue: formData.get("emailNotifyOnNewIssue") === "on",
    inAppNotifyOnNewIssue: formData.get("inAppNotifyOnNewIssue") === "on",

    emailWatchNewIssuesGlobal:
      formData.get("emailWatchNewIssuesGlobal") === "on",
    inAppWatchNewIssuesGlobal:
      formData.get("inAppWatchNewIssuesGlobal") === "on",
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

    revalidatePath("/settings");
    return ok({ success: true });
  } catch (error) {
    console.error("updateNotificationPreferencesAction failed", error);
    return err("SERVER", "Failed to update preferences");
  }
}
