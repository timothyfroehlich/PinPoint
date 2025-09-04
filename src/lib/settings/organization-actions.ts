"use server";
import { revalidatePath } from "next/cache";
import { getRequestAuthContext } from "~/server/auth/context";
import { withOrgRLS } from "~/server/db/utils/rls";
import { db } from "../dal/shared";
import { eq } from "drizzle-orm";
import { organizations } from "../../server/db/schema";

interface ActionResult { success: boolean; message?: string }

export async function updateAnonymousIssueToggleAction(enabled: boolean): Promise<ActionResult> {
  try {
    const authContext = await getRequestAuthContext();
    if (authContext.kind !== "authorized") {
      throw new Error("Member access required");
    }
    
    await withOrgRLS(db, authContext.org.id, async (tx) => {
      await tx
        .update(organizations)
        .set({ allow_anonymous_issues: enabled })
        .where(eq(organizations.id, authContext.org.id));
    });
    revalidatePath("/settings/organization");
    return { success: true };
  } catch (e) {
    console.error("Failed updating anonymous issue toggle", e);
    return { success: false, message: (e as Error).message };
  }
}
