"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";
import { type Result, ok, err } from "~/lib/result";
import { serverActionError } from "~/lib/observability/report-error";
import { z } from "zod";

const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  discordEnabled: z.boolean().optional(),
  suppressOwnActions: z.boolean().optional(),

  // Granular Preferences
  emailNotifyOnAssigned: z.boolean().optional(),
  inAppNotifyOnAssigned: z.boolean().optional(),
  discordNotifyOnAssigned: z.boolean().optional(),
  emailNotifyOnStatusChange: z.boolean().optional(),
  inAppNotifyOnStatusChange: z.boolean().optional(),
  discordNotifyOnStatusChange: z.boolean().optional(),
  emailNotifyOnNewComment: z.boolean().optional(),
  inAppNotifyOnNewComment: z.boolean().optional(),
  discordNotifyOnNewComment: z.boolean().optional(),
  emailNotifyOnMentioned: z.boolean().optional(),
  inAppNotifyOnMentioned: z.boolean().optional(),
  discordNotifyOnMentioned: z.boolean().optional(),
  emailNotifyOnNewIssue: z.boolean().optional(),
  inAppNotifyOnNewIssue: z.boolean().optional(),
  discordNotifyOnNewIssue: z.boolean().optional(),

  emailWatchNewIssuesGlobal: z.boolean().optional(),
  inAppWatchNewIssuesGlobal: z.boolean().optional(),
  discordWatchNewIssuesGlobal: z.boolean().optional(),
});

type PrefField = keyof z.infer<typeof updatePreferencesSchema>;

const PREF_FIELDS = Object.keys(
  updatePreferencesSchema.shape
) as readonly PrefField[];

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

  // Absent fields are preserved (not coerced to false). The SwitchWithFormSupport
  // hidden input always submits "on" or "off" from the resolved switch state, so
  // a JS-enabled save sends every rendered field. Anything missing — direct API
  // call, future per-toggle save, no-JS submit — leaves that column untouched.
  const rawData: Partial<Record<PrefField, boolean>> = {};
  for (const name of PREF_FIELDS) {
    const value = formData.get(name);
    if (value === "on") rawData[name] = true;
    else if (value === "off") rawData[name] = false;
  }

  const validation = updatePreferencesSchema.safeParse(rawData);
  if (!validation.success) {
    return err("VALIDATION", "Invalid input");
  }

  if (Object.keys(validation.data).length === 0) {
    revalidatePath("/settings");
    return ok({ success: true });
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
    return serverActionError(error, "SERVER", "Failed to update preferences", {
      action: "updateNotificationPreferencesAction",
    });
  }
}
