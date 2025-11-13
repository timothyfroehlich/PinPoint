import type React from "react";
import { Navigation } from "~/components/layout/navigation";

/**
 * Layout for authenticated app pages (dashboard, issues, machines, etc.)
 *
 * Includes top navigation bar
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Navigation />
      {children}
    </>
  );
}
