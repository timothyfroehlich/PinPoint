"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createProtectedAction,
  formFields,
  type ProtectedActionResult,
} from "~/lib/actions";
import { checkPermission } from "~/lib/permissions/helpers";
import { err, ok } from "~/lib/result";
import { REPORT_MODE_VALUES, type ReportMode } from "~/lib/types";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

const reportModeSchema = z.enum(REPORT_MODE_VALUES, {
  error: "Choose valid report screens.",
});

const reportModesSchema = z.object({
  mobileReportMode: reportModeSchema,
  desktopReportMode: reportModeSchema,
});

export type UpdateDefaultReportModeResult = ProtectedActionResult<{
  mobileMode: ReportMode;
  desktopMode: ReportMode;
}>;

const updateDefaultReportModeProtected = createProtectedAction({
  actionName: "updateDefaultReportModeAction",
  schema: reportModesSchema,
  mapInput: (formData: FormData) =>
    formFields(formData, ["mobileReportMode", "desktopReportMode"]),
  permission: "issues.report.default_mode",
  handler: async (
    { mobileReportMode, desktopReportMode },
    { user, accessLevel }
  ) => {
    if (
      (mobileReportMode === "multiple" || desktopReportMode === "multiple") &&
      !checkPermission("issues.report.quick", accessLevel)
    ) {
      return err("FORBIDDEN", "Multiple issues is not available to you.");
    }

    const [updated] = await db
      .update(userProfiles)
      .set({ mobileReportMode, desktopReportMode, updatedAt: new Date() })
      .where(eq(userProfiles.id, user.id))
      .returning({
        mobileMode: userProfiles.mobileReportMode,
        desktopMode: userProfiles.desktopReportMode,
      });

    if (!updated) {
      return err("SERVER", "Your profile could not be updated. Try again.");
    }

    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return ok(updated);
  },
});

export async function updateDefaultReportModeAction(
  _prevState: UpdateDefaultReportModeResult | undefined,
  formData: FormData
): Promise<UpdateDefaultReportModeResult> {
  return await updateDefaultReportModeProtected(formData);
}
