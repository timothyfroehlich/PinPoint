import "server-only";
import { createClient } from "~/lib/supabase/server";
import { checkPermission } from "~/lib/permissions/helpers";
import { getUserAccessLevel } from "~/lib/permissions/access";

/**
 * Gate an Admin Integrations mutation on the manage-integrations capability
 * (spec §7, CORE-ARCH-008 — checks go through the matrix). Shared by the
 * Discord and Pinball Map section actions so the gate cannot drift between two
 * copies of a security check. Throws on failure: a section action that reaches
 * a write without clearing this has no business proceeding.
 */
export async function verifyIntegrationsAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    throw new Error(
      "Forbidden: You do not have permission to manage integrations"
    );
  }
  return { userId: user.id };
}
