"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createProtectedAction,
  type ProtectedActionResult,
} from "~/lib/actions";
import { ok, err } from "~/lib/result";
import { db } from "~/server/db";
import { notificationPreferences } from "~/server/db/schema";

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

const formPreferenceValueSchema = z.enum(["on", "off"]);

export type UpdatePreferencesResult = ProtectedActionResult<
  { success: boolean },
  "VALIDATION"
>;

const updatePreferencesProtected = createProtectedAction({
  actionName: "updateNotificationPreferencesAction",
  permission: "notifications.manage_own",
  handler: async (formData: FormData, { user }) => {
    // Absent fields are preserved, not coerced to false: only "on"/"off" write.
    // A disabled toggle submits nothing (like a native checkbox; PP-bhd7.7), as
    // do a direct API call or a partial submit — each leaves its column
    // untouched, so a disabled Discord switch never overwrites the saved value.
    const rawData: Partial<Record<PrefField, boolean>> = {};
    for (const name of PREF_FIELDS) {
      const value = formData.get(name);
      if (value === null) continue;
      const parsedValue = formPreferenceValueSchema.safeParse(value);
      if (!parsedValue.success) {
        return err("VALIDATION", "Invalid input");
      }
      rawData[name] = parsedValue.data === "on";
    }

    const validation = updatePreferencesSchema.safeParse(rawData);
    if (!validation.success) {
      return err("VALIDATION", "Invalid input");
    }

    if (Object.keys(validation.data).length === 0) {
      revalidatePath("/settings");
      return ok({ success: true });
    }

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
  },
});

export async function updateNotificationPreferencesAction(
  _prevState: UpdatePreferencesResult | undefined,
  formData: FormData
): Promise<UpdatePreferencesResult> {
  return await updatePreferencesProtected(formData);
}
