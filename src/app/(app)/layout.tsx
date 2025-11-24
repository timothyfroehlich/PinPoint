import type React from "react";
import { DashboardLayout } from "~/components/layout/DashboardLayout";

/**
 * Layout for authenticated app pages (dashboard, issues, machines, etc.)
 *
 * Uses the new Sidebar + Dashboard layout structure.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <DashboardLayout>{children}</DashboardLayout>;
}
