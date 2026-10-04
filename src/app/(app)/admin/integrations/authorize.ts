import "server-only";

import { getUserAccessLevel } from "~/lib/permissions/access";
import { checkPermission } from "~/lib/permissions/helpers";
import { createClient } from "~/lib/supabase/server";

export type IntegrationsAuthorization =
  { ok: true; userId: string } | { ok: false };

/**
 * The manage-integrations gate every Integrations page action checks
 * (admin-integrations §7.1): a signed-in user with the capability.
 */
export async function authorizeIntegrationsAdmin(): Promise<IntegrationsAuthorization> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const accessLevel = await getUserAccessLevel(user.id);
  if (!checkPermission("admin.integrations.manage", accessLevel)) {
    return { ok: false };
  }
  return { ok: true, userId: user.id };
}
