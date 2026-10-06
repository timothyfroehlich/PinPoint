import { getViewer } from "~/lib/auth/viewer";
import { redirect } from "next/navigation";
import type React from "react";
import { Forbidden } from "~/components/errors/Forbidden";
import { getLoginUrl } from "~/lib/url";
import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { userId, role } = await getViewer();

  if (!userId) {
    redirect(getLoginUrl("/admin"));
  }

  if (!checkPermission("admin.access", getAccessLevel(role))) {
    return <Forbidden role={role} />;
  }

  return <>{children}</>;
}
