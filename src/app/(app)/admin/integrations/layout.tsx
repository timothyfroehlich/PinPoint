import type React from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Forbidden } from "~/components/errors/Forbidden";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { createClient } from "~/lib/supabase/server";
import { getLoginUrl } from "~/lib/url";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

/**
 * The page and every nested integration route require the same capability.
 * The parent Admin layout also checks broad admin access; this narrower guard
 * keeps the route aligned with the action-level permission.
 */
export default async function AdminIntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(getLoginUrl("/admin/integrations"));

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (
    !checkPermission("admin.integrations.manage", getAccessLevel(profile?.role))
  ) {
    return <Forbidden role={profile?.role ?? null} />;
  }

  return <>{children}</>;
}
