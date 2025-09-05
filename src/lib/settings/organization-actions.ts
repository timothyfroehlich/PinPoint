"use server";
import { revalidatePath } from "next/cache";
import { getRequestAuthContext } from "~/server/auth/context";
import { updateOrganizationSettings } from "~/lib/dal/organizations";

interface ActionResult { success: boolean; message?: string }

export async function updateAnonymousIssueToggleAction(enabled: boolean): Promise<ActionResult> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    
    await updateOrganizationSettings(authContext.org.id, {
      allow_anonymous_issues: enabled,
    });
    
    revalidatePath("/settings/organization");
    return { success: true };
  } catch (e) {
    console.error("Failed updating anonymous issue toggle", e);
    return { success: false, message: (e as Error).message };
  }
}
