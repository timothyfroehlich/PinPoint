import type React from "react";
import { DashboardLayout } from "~/components/layout/DashboardLayout";
import { createClient } from "~/lib/supabase/server";

/**
 * Layout for authenticated app pages (dashboard, issues, machines, etc.)
 *
 * Uses the new Sidebar + Dashboard layout structure.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
