import type React from "react";
import { MainLayout } from "~/components/layout/MainLayout";

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
  return <MainLayout>{children}</MainLayout>;
}
