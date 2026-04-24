import type React from "react";

/**
 * Placeholder layout for the admin integrations section.
 *
 * Admin auth is enforced by the parent `/admin` layout. This layout exists
 * so future sibling integration pages (e.g. /admin/integrations/slack) have
 * a shared wrapper to grow into.
 */
export default function AdminIntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <>{children}</>;
}
