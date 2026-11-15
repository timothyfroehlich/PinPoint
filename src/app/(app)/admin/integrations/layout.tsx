import type React from "react";
import { redirect } from "next/navigation";
import { Forbidden } from "~/components/errors/Forbidden";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { getViewer } from "~/lib/auth/viewer";
import { getLoginUrl } from "~/lib/url";

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
  const { userId, role } = await getViewer();
  if (!userId) redirect(getLoginUrl("/admin/integrations"));

  if (!checkPermission("admin.integrations.manage", getAccessLevel(role))) {
    return <Forbidden role={role} />;
  }

  return <>{children}</>;
}
