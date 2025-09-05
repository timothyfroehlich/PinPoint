"use server";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "~/lib/actions/shared";
import { updateOrganizationSettings } from "~/lib/dal/organizations";

interface ActionResult { success: boolean; message?: string }

export async function updateAnonymousIssueToggleAction(enabled: boolean): Promise<ActionResult> {
  try {
    const { organizationId } = await requireOrgContext();
    
    await updateOrganizationSettings(organizationId, {
      allow_anonymous_issues: enabled,
    });
    
    revalidatePath("/settings/organization");
    return { success: true };
  } catch (e) {
    console.error("Failed updating anonymous issue toggle", e);
    return { success: false, message: (e as Error).message };
  }
}
