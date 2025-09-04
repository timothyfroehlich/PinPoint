"use server";
import { revalidatePath } from "next/cache";
import { ensureOrgContextAndBindRLS } from "~/lib/organization-context";
import { updateOrganization } from "~/lib/dal/organizations";
import { eq } from "drizzle-orm";

interface ActionResult { success: boolean; message?: string }

export async function updateAnonymousIssueToggleAction(enabled: boolean): Promise<ActionResult> {
  try {
    await ensureOrgContextAndBindRLS(async (tx, context) => {
      await tx
        .update(organizations)
        .set({ allow_anonymous_issues: enabled })
        .where(eq(organizations.id, context.organization.id));
    });
    revalidatePath("/settings/organization");
    return { success: true };
  } catch (e) {
    console.error("Failed updating anonymous issue toggle", e);
    return { success: false, message: (e as Error).message };
  }
}
