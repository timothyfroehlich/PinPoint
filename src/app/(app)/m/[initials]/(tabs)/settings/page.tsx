import type React from "react";
import { notFound } from "next/navigation";
import { getMachineForLayout } from "~/app/(app)/m/[initials]/_data";
import { SettingsTab } from "~/components/machines/settings/SettingsTab";

/**
 * Machine Settings Tab (/m/[initials]/settings)
 *
 * UI-only scaffold — no schema or server actions yet (PP-43q3).
 * Renders the SettingsTab component with hardcoded sample data.
 * canEdit is hardcoded true; permission check lands with the schema PR.
 */
export default async function MachineSettingsTab({
  params,
}: {
  params: Promise<{ initials: string }>;
}): Promise<React.JSX.Element> {
  const { initials } = await params;

  const { machine } = await getMachineForLayout(initials);
  if (!machine) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SettingsTab canEdit={true} />
    </div>
  );
}
